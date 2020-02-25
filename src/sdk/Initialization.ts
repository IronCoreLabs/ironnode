import Future from "futurejs";
import {DeviceCreateOptions, DeviceDetails, UserCreateOptions} from "../../ironnode";
import UserApi from "../api/UserApi";
import {Base64String, KeyPair} from "../commonTypes";
import {ErrorCodes} from "../Constants";
import {decryptUserMasterKey, encryptUserMasterKey} from "../crypto/AES";
import * as Recrypt from "../crypto/Recrypt";
import ApiState from "../lib/ApiState";
import SDKError from "../lib/SDKError";
import {Codec} from "../lib/Utils";
import * as DocumentSDK from "./DocumentSDK";
import * as GroupSDK from "./GroupSDK";
import * as UserSDK from "./UserSDK";

const SDK = {
    document: DocumentSDK,
    group: GroupSDK,
    user: UserSDK,
};

/**
 * Sync a new user within the IronCore identity system. Generate a new user master key pair, encrypt the private key with the provided
 * password, and send the public key and the encrypted private key to the API.
 */
const createNewUser = (jwt: string, password: string, options: UserCreateOptions) =>
    Recrypt.generateKeyPair()
        .errorMap((e) => new SDKError(e, ErrorCodes.USER_MASTER_KEY_GENERATION_FAILURE))
        .flatMap((keypair) => {
            return encryptUserMasterKey(password, keypair.privateKey).flatMap((encryptedPrivateKey) =>
                UserApi.callUserCreateApi(jwt, keypair.publicKey, encryptedPrivateKey, options.needsRotation).map((newUser) => ({
                    accountID: newUser.id,
                    segmentID: newUser.segmentId,
                    userMasterPublicKey: newUser.userMasterPublicKey,
                    needsRotation: newUser.needsRotation,
                }))
            );
        });

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
    return UserApi.getAccountContextPublicKey(accountID, segmentID, privateSigningKey).flatMap<typeof SDK>((user) => {
        ApiState.setAccountContext(
            user.id,
            segmentID,
            Codec.PublicKey.fromBase64(user.userMasterPublicKey),
            Codec.Buffer.fromBase64(user.userPrivateKey),
            Codec.Buffer.fromBase64(privateDeviceKey),
            Codec.Buffer.fromBase64(privateSigningKey),
            user.currentKeyId
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
    return UserApi.callUserVerifyApi(jwt).map((existingUser) => {
        if (!existingUser) {
            return undefined;
        }
        return {
            accountID: existingUser.id,
            segmentID: existingUser.segmentId,
            userMasterPublicKey: existingUser.userMasterPublicKey,
            needsRotation: existingUser.needsRotation,
            groupsNeedingRotation: existingUser.groupsNeedingRotation,
        };
    });
}

/**
 * Sync a new user within the IronCore system given a valid signed JWT for the user and a provided password to escrow their
 * master private key.
 */
export function createUser(jwt: string, password: string, options: UserCreateOptions) {
    return userVerify(jwt).flatMap((user) => (user ? Future.of(user) : createNewUser(jwt, password, options)));
}

/**
 * Generate a new pair device and signing key pair for the user provided within the signed JWT and the password to decrypt their master private key. Generates
 * a new keypair, generates and stores a transform key for that user, and returns both the device and signing key pairs back to the caller.
 */
export function generateDevice(jwt: string, password: string, options: DeviceCreateOptions): Future<SDKError, DeviceDetails> {
    return UserApi.callUserVerifyApi(jwt).flatMap((user) => {
        if (!user) {
            return Future.reject(new SDKError(new Error("No user exists for the provided ID."), 0));
        }

        return decryptUserMasterKey(password, Codec.Buffer.fromBase64(user.userPrivateKey)).flatMap(({decryptedPrivateKey}) => {
            const userMasterKeyPair = {publicKey: Codec.PublicKey.fromBase64(user.userMasterPublicKey), privateKey: decryptedPrivateKey};
            return generateDeviceAndTransformKeys(jwt, userMasterKeyPair).flatMap((deviceAdd) =>
                UserApi.callUserDeviceAdd(
                    jwt,
                    userMasterKeyPair.publicKey,
                    deviceAdd.transformKey,
                    deviceAdd.signature.signature,
                    deviceAdd.signature.ts,
                    options
                ).map(() => ({
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
                }))
            );
        });
    });
}
