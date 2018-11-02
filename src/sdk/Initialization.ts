import UserApi, {ApiServerUserResponse} from "../api/UserApi";
import {ErrorCodes} from "../Constants";
import SDKError from "../lib/SDKError";
import Future from "futurejs";
import ApiState from "../lib/ApiState";
import {Codec} from "../lib/Utils";
import {encryptUserMasterKey, decryptUserMasterKey} from "../crypto/AES";
import * as Recrypt from "../crypto/Recrypt";
import {Base64String, KeyPair} from "../commonTypes";
import {DeviceDetails, ApiUserResponse} from "../../ironnode";
import * as DocumentSDK from "./DocumentSDK";
import * as GroupSDK from "./GroupSDK";
import * as UserSDK from "./UserSDK";

const SDK = {
    document: DocumentSDK,
    group: GroupSDK,
    user: UserSDK,
};

/**
 * Map user object returned from Identity API into consumable object exposed out to consumers. Removes unnecessary
 * fields as well as stays consistent with key names.
 */
function mapUserObject(user: ApiServerUserResponse | undefined): ApiUserResponse | undefined {
    if (!user) {
        return undefined;
    }
    return {
        accountID: user.id,
        segmentID: user.segmentId,
        userMasterPublicKey: user.userMasterPublicKey,
    };
}

/**
 * Sync a new user within the IronCore identity system. Generate a new user master key pair, encrypt the private key with the provided
 * password, and send the public key and the encrypted private key to the API.
 */
function createNewUser(jwt: string, password: string) {
    return Recrypt.generateKeyPair()
        .errorMap((e) => new SDKError(e, ErrorCodes.USER_MASTER_KEY_GENERATION_FAILURE))
        .flatMap((keypair) => {
            return encryptUserMasterKey(password, keypair.privateKey).flatMap((encryptedPrivateKey) =>
                UserApi.callUserCreateApi(jwt, keypair.publicKey, encryptedPrivateKey).map(mapUserObject)
            );
        });
}

/**
 * Generate all the necessary keys, transforms, and signatures to be able to add a new user device. Generates both a device key pair, signing key pair, and
 * transform key between the provided user private key and device public key. Then generates a device add signature that is necessary to hit the API.
 */
function generateDeviceAndTransformKeys(jwt: string, userMasterKeyPair: KeyPair) {
    const signingKeyPair = Recrypt.generateEd25519KeyPair();
    return Recrypt.generateKeyPair()
        .flatMap((deviceKeyPair) => {
            return Recrypt.generateTransformKey(userMasterKeyPair.privateKey, deviceKeyPair.publicKey, signingKeyPair.privateKey).map((transformKey) => ({
                signingKeys: signingKeyPair,
                deviceKeys: deviceKeyPair,
                transformKey,
            }));
        })
        .flatMap((deviceKeys) => {
            return Recrypt.generateDeviceAddSignature(jwt, userMasterKeyPair, deviceKeys.transformKey).map((signature) => ({
                ...deviceKeys,
                signature,
            }));
        })
        .errorMap((e) => new SDKError(e, ErrorCodes.USER_DEVICE_KEY_GENERATION_FAILURE));
}

/**
 * Initizlize the Node SDK. Retrieves the public key for the provided account ID and sets all other provided data into the API state
 * library for future requests.
 */
export function initialize(accountID: string, segmentID: number, privateDeviceKey: Base64String, privateSigningKey: Base64String) {
    return UserApi.getAccountContextPublicKey(accountID, segmentID, privateSigningKey).flatMap<typeof SDK>(({result}) => {
        if (result.length === 0) {
            return Future.reject(new SDKError(new Error("Provided account ID could not be found."), ErrorCodes.INITIALIZE_INVALID_ACCOUNT_ID));
        }
        const [account] = result;
        ApiState.setAccountContext(
            account.id,
            segmentID,
            Codec.PublicKey.fromBase64(account.userMasterPublicKey),
            Codec.Buffer.fromBase64(privateDeviceKey),
            Codec.Buffer.fromBase64(privateSigningKey)
        );
        return Future.of(SDK);
    });
}

/**
 * Call user verify endpoint and map the result to a user API object if the user exists or undefined if the
 * user doesn't exist.
 * @param {string} JWT Signed JWT for the user to verify
 */
export function userVerify(jwt: string) {
    return UserApi.callUserVerifyApi(jwt).map(mapUserObject);
}

/**
 * Sync a new user within the IronCore system given a valid signed JWT for the user and a provided password to escrow their
 * master private key.
 */
export function createUser(jwt: string, password: string) {
    return userVerify(jwt).flatMap((user) => {
        if (user) {
            return Future.of(user);
        }
        return createNewUser(jwt, password);
    });
}

/**
 * Generate a new pair device and signing key pair for the user provided within the signed JWT and the password to decrypt their master private key. Generates
 * a new keypair, generates and stores a transform key for that user, and returns both the device and signing key pairs back to the caller.
 */
export function generateDevice(jwt: string, password: string): Future<SDKError, DeviceDetails> {
    return UserApi.callUserVerifyApi(jwt).flatMap((user) => {
        if (!user) {
            return Future.reject(new SDKError(new Error("No user exists for the provided ID."), 0));
        }

        return decryptUserMasterKey(password, Codec.Buffer.fromBase64(user.userPrivateKey)).flatMap((privateKey) => {
            const userMasterKeyPair = {publicKey: Codec.PublicKey.fromBase64(user.userMasterPublicKey), privateKey};
            return generateDeviceAndTransformKeys(jwt, userMasterKeyPair).flatMap((deviceAdd) =>
                UserApi.callUserDeviceAdd(jwt, userMasterKeyPair.publicKey, deviceAdd.transformKey, deviceAdd.signature.signature, deviceAdd.signature.ts).map(
                    () => ({
                        accountID: user.id,
                        segmentID: user.segmentId,
                        deviceKeys: {
                            publicKey: Codec.PublicKey.toBase64(deviceAdd.deviceKeys.publicKey),
                            privateKey: Codec.Buffer.toBase64(deviceAdd.deviceKeys.privateKey),
                        },
                        signingKeys: {
                            publicKey: Codec.Buffer.toBase64(deviceAdd.signingKeys.publicKey),
                            privateKey: Codec.Buffer.toBase64(deviceAdd.signingKeys.privateKey),
                        },
                    })
                )
            );
        });
    });
}
