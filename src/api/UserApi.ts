import {TransformKey} from "@ironcorelabs/recrypt-node-binding";
import Future from "futurejs";
import {DeviceCreateOptions, UserDeviceListResponse} from "../../ironnode";
import {AugmentationFactor, Base64String, MessageSignature, PrivateKey, PublicKey} from "../commonTypes";
import {ErrorCodes} from "../Constants";
import {computeEd25519PublicKey} from "../crypto/Recrypt";
import ApiState from "../lib/ApiState";
import SDKError from "../lib/SDKError";
import {Codec, transformKeyToBase64} from "../lib/Utils";
import * as ApiRequest from "./ApiRequest";

interface UserUpdateApiResponse {
    id: string;
    status: number;
    userPrivateKey: PrivateKey<Base64String>;
    userMasterPublicKey: PublicKey<Base64String>;
}
interface ApiUserResponse extends UserUpdateApiResponse {
    segmentId: number;
    needsRotation: boolean;
    currentKeyId: number;
}
type UserVerifyResponseType = (ApiUserResponse & {groupsNeedingRotation: string[]}) | undefined;
type CurrentUserGetResponse = ApiUserResponse & {groupsNeedingRotation: string[]};
type UserCreateResponseType = ApiUserResponse;
interface UserDeviceAddResponse {
    id: number;
    devicePublicKey: PublicKey<Base64String>;
    name: string | null;
    created: string;
    updated: string;
}
export interface UserKeyListResponseType {
    result: Array<{
        id: string;
        userMasterPublicKey: PublicKey<Base64String>;
    }>;
}
interface UserKeyUpdateResponse {
    currentKeyId: number;
    userPrivateKey: Base64String;
    needsRotation: boolean;
}

/**
 * Generate a signature for the current user from user state
 */
const getSignatureHeader = () => {
    const {segmentID, accountID} = ApiState.accountAndSegmentIDs();
    return ApiRequest.createSignature(segmentID, accountID, ApiState.signingKeys());
};

/**
 * Get information about the current user present in the provided signature
 */
const getCurrentUser = (sig: MessageSignature) => ({
    url: `users/current`,
    options: {
        method: "GET",
        headers: {
            Authorization: ApiRequest.getAuthHeader(sig),
        },
    },
    errorCode: ErrorCodes.INITIALIZE_INVALID_ACCOUNT_ID,
});

/**
 * Generate parameters for the init call with proper URL, options, and error code
 */
const verify = (jwt: string) => ({
    url: `users/verify?returnKeys=true`,
    options: {
        headers: {
            Authorization: `jwt ${jwt}`,
        },
    },
    errorCode: ErrorCodes.USER_VERIFY_API_REQUEST_FAILURE,
});

/**
 * Generate API request details for user create request.
 */
const userCreate = (jwt: string, userPublicKey: PublicKey<Buffer>, encryptedUserPrivateKey: Buffer, needsRotation: boolean) => ({
    url: `users`,
    options: {
        method: "POST",
        headers: {
            Authorization: `jwt ${jwt}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            userPublicKey: Codec.PublicKey.toBase64(userPublicKey),
            userPrivateKey: Codec.Buffer.toBase64(encryptedUserPrivateKey),
            needsRotation,
        }),
    },
    errorCode: ErrorCodes.USER_CREATE_REQUEST_FAILURE,
});

/**
 * Rotate the provided users key given their encrypted rotated private key and the augmentation factor used during rotation.
 */
const userUpdateKey = (
    sig: MessageSignature,
    userID: string,
    keyId: number,
    encryptedPrivateKey: PrivateKey<Buffer>,
    augmentationFactor: AugmentationFactor
) => ({
    url: `users/${encodeURIComponent(userID)}/keys/${keyId}`,
    options: {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: ApiRequest.getAuthHeader(sig),
        },
        body: JSON.stringify({
            userPrivateKey: encryptedPrivateKey.toString("base64"),
            augmentationFactor: augmentationFactor.toString("base64"),
        }),
    },
    errorCode: ErrorCodes.USER_UPDATE_KEY_REQUEST_FAILURE,
});

/**
 * Add a new set of device/signing/transform keys to the user
 * @param {string}              jwtToken      Users JWT token
 * @param {PublicKey}           userPublicKey Users master public key
 * @param {TransformKey}        transformKey  Device transform key
 * @param {Uint8Array}          signature     Signature for device add request
 * @param {number}              timestamp     Timestamp of signature generation
 * @param {DeviceCreateOptions} options       Device create options.
 */
const userDeviceAdd = (
    jwtToken: string,
    userPublicKey: PublicKey<Buffer>,
    transformKey: TransformKey,
    signature: Buffer,
    timestamp: number,
    options: DeviceCreateOptions
) => ({
    url: `users/devices`,
    options: {
        method: "POST",
        headers: {
            Authorization: `jwt ${jwtToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            timestamp,
            userPublicKey: Codec.PublicKey.toBase64(userPublicKey),
            device: {
                transformKey: transformKeyToBase64(transformKey),
                name: options.deviceName || undefined,
            },
            signature: Codec.Buffer.toBase64(signature),
        }),
    },
    errorCode: ErrorCodes.USER_DEVICE_ADD_REQUEST_FAILURE,
});

/**
 * Generate API request details for user key list request
 * @param {MessageSignature} sign     Signed message to verify the current user
 * @param {string[]}         userList List of user IDs to retrieve
 */
const userKeyList = (sign: MessageSignature, userList: string[]) => ({
    url: `users?id=${encodeURIComponent(userList.join(","))}`,
    options: {
        method: "GET",
        headers: {
            Authorization: ApiRequest.getAuthHeader(sign),
        },
    },
    errorCode: ErrorCodes.USER_KEY_LIST_REQUEST_FAILURE,
});

/**
 * Request a users list of devices.
 */
const userDeviceList = (sign: MessageSignature, accountID: string) => ({
    url: `users/${encodeURIComponent(accountID)}/devices`,
    options: {
        method: "GET",
        headers: {
            Authorization: ApiRequest.getAuthHeader(sign),
        },
    },
    errorCode: ErrorCodes.USER_DEVICE_LIST_REQUEST_FAILURE,
});

/**
 * Delete a users device keys
 */
const userDeviceDelete = (sign: MessageSignature, accountID: string, deviceID?: number) => ({
    url: `users/${encodeURIComponent(accountID)}/devices/${deviceID || "current"}`,
    options: {
        method: "DELETE",
        headers: {
            Authorization: ApiRequest.getAuthHeader(sign),
        },
    },
    errorCode: ErrorCodes.USER_DEVICE_DELETE_REQUEST_FAILURE,
});

/**
 * Update the encrypted private key for the currently logged in user
 */
const userUpdateEncryptedPrivateKey = (sign: MessageSignature, accountId: string, encryptedPrivateKey: PrivateKey<Buffer>) => ({
    url: `users/${encodeURIComponent(accountId)}`,
    options: {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: ApiRequest.getAuthHeader(sign),
        },
        body: JSON.stringify({
            userPrivateKey: encryptedPrivateKey.toString("base64"),
        }),
    },
    errorCode: ErrorCodes.USER_UPDATE_REQUEST_FAILURE,
});

export default {
    /**
     * API method to get the master public key for the user who the SDK is acting as.
     */
    getAccountContextPublicKey(accountID: string, segmentID: number, signingPrivateKey: Base64String) {
        const privateKeyBuffer = Codec.Buffer.fromBase64(signingPrivateKey);
        const signatureHeader = ApiRequest.createSignature(segmentID, accountID, {
            publicKey: computeEd25519PublicKey(privateKeyBuffer),
            privateKey: privateKeyBuffer,
        });

        const {url, options, errorCode} = getCurrentUser(signatureHeader);
        return ApiRequest.fetchJSON<CurrentUserGetResponse>(url, errorCode, options);
    },

    /**
     * Invoke user verify API and maps result to determine if we got back a user or not
     * @param {string} jwt JWT token to pass to verify API
     */
    callUserVerifyApi(jwt: string): Future<SDKError, UserVerifyResponseType | undefined> {
        const {url, options, errorCode} = verify(jwt);
        return ApiRequest.fetchJSON<UserVerifyResponseType>(url, errorCode, options).map((data) => data || undefined);
    },

    /**
     * Invoke user create API with jwt and users public key and encrypted private key.
     */
    callUserCreateApi(
        jwt: string,
        userPublicKey: PublicKey<Buffer>,
        encryptedPrivateKey: Buffer,
        needsRotation: boolean
    ): Future<SDKError, UserCreateResponseType> {
        const {url, options, errorCode} = userCreate(jwt, userPublicKey, encryptedPrivateKey, needsRotation);
        return ApiRequest.fetchJSON<UserCreateResponseType>(url, errorCode, options);
    },

    /**
     * Invoke user update keys with encrypted augmented privateKey and augmentation factor.
     */
    callUserKeyUpdateApi(encryptedPrivateKey: PrivateKey<Buffer>, augmentationFactor: AugmentationFactor) {
        const {accountID} = ApiState.accountAndSegmentIDs();
        const keyId = ApiState.keyId();
        const {url, options, errorCode} = userUpdateKey(getSignatureHeader(), accountID, keyId, encryptedPrivateKey, augmentationFactor);
        return ApiRequest.fetchJSON<UserKeyUpdateResponse>(url, errorCode, options);
    },

    /**
     * Invoke the user device add API with the provided device/signing/transform keys
     * @param {string}       jwtToken      Users authorized JWT token
     * @param {PublicKey}    userPublicKey Users master public key
     * @param {TransformKey} transformKey  Transform key from user master key to device key
     * @param {Buffer}       signature     Calculated signature to validate request
     * @param {number}       timestamp     Timestamp of signature generation
     */
    callUserDeviceAdd(
        jwtToken: string,
        userPublicKey: PublicKey<Buffer>,
        transformKey: TransformKey,
        signature: Buffer,
        timestamp: number,
        createOptions: DeviceCreateOptions
    ) {
        const {url, options, errorCode} = userDeviceAdd(jwtToken, userPublicKey, transformKey, signature, timestamp, createOptions);
        return ApiRequest.fetchJSON<UserDeviceAddResponse>(url, errorCode, options);
    },

    /**
     * Get a list of public keys for the provided list of users
     * @param {string[]} userList List of user IDs to retrieve
     */
    callUserKeyListApi(userList: string[]): Future<SDKError, UserKeyListResponseType> {
        if (!userList.length) {
            return Future.of({result: []});
        }
        const {url, options, errorCode} = userKeyList(getSignatureHeader(), userList);
        return ApiRequest.fetchJSON<UserKeyListResponseType>(url, errorCode, options);
    },

    /**
     * Make a request to the API to update the current users encrypted private master key.
     */
    callUserUpdatePrivateKey(userEncryptedPrivateKey: PrivateKey<Buffer>) {
        const {accountID} = ApiState.accountAndSegmentIDs();
        const {url, options, errorCode} = userUpdateEncryptedPrivateKey(getSignatureHeader(), accountID, userEncryptedPrivateKey);
        return ApiRequest.fetchJSON<UserUpdateApiResponse>(url, errorCode, options);
    },

    /**
     * Make request to get a list of a users devices. Only ever works when acting as the currently authenticated user of the SDK.
     */
    callUserDeviceListApi(): Future<SDKError, UserDeviceListResponse> {
        const {url, options, errorCode} = userDeviceList(getSignatureHeader(), ApiState.accountAndSegmentIDs().accountID);
        return ApiRequest.fetchJSON<UserDeviceListResponse>(url, errorCode, options);
    },

    /**
     * Make request to delete a device given its ID. Only ever works when acting as the currently authenticated user of the SDK.
     */
    callUserDeviceDeleteApi(deviceID?: number) {
        const {accountID} = ApiState.accountAndSegmentIDs();
        const {url, options, errorCode} = userDeviceDelete(getSignatureHeader(), accountID, deviceID);
        return ApiRequest.fetchJSON<{id: number}>(url, errorCode, options);
    },
};
