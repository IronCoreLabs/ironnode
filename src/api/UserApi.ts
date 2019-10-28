import {TransformKey} from "@ironcorelabs/recrypt-node-binding";
import Future from "futurejs";
import {DeviceCreateOptions, UserDeviceListResponse} from "../../ironnode";
import {Base64String, MessageSignature, PrivateKey, PublicKey} from "../commonTypes";
import {ErrorCodes} from "../Constants";
import {computeEd25519PublicKey} from "../crypto/Recrypt";
import ApiState from "../lib/ApiState";
import SDKError from "../lib/SDKError";
import {Codec, transformKeyToBase64} from "../lib/Utils";
import * as ApiRequest from "./ApiRequest";

export interface ApiServerUserResponse {
    id: string;
    segmentId: number;
    status: number;
    userMasterPublicKey: PublicKey<Base64String>;
    userPrivateKey: PrivateKey<Base64String>;
}
type UserVerifyResponseType = ApiServerUserResponse | undefined;
type UserCreateResponseType = ApiServerUserResponse;
type UserUpdateResponseType = ApiServerUserResponse;
export interface UserKeyListResponseType {
    result: Array<{
        id: string;
        userMasterPublicKey: PublicKey<Base64String>;
    }>;
}

/**
 * Generate a signature for the current user from user state
 */
function getSignatureHeader() {
    const {segmentID, accountID} = ApiState.accountAndSegmentIDs();
    return ApiRequest.createSignature(segmentID, accountID, ApiState.signingKeys());
}

/**
 * Generate parameters for the init call with proper URL, options, and error code
 */
function verify(jwt: string) {
    return {
        url: `users/verify?returnKeys=true`,
        options: {
            headers: {
                Authorization: `jwt ${jwt}`,
            },
        },
        errorCode: ErrorCodes.USER_VERIFY_API_REQUEST_FAILURE,
    };
}

/**
 * Generate API request details for user create request.
 * @param {string}            jwt                     JWT token
 * @param {PublicKey<Buffer>} userPublicKey           Users master public key
 * @param {Buffer}            encryptedUserPrivateKey Users encrypted master private key
 */
function userCreate(jwt: string, userPublicKey: PublicKey<Buffer>, encryptedUserPrivateKey: Buffer) {
    return {
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
            }),
        },
        errorCode: ErrorCodes.USER_CREATE_REQUEST_FAILURE,
    };
}

/**
 * Add a new set of device/signing/transform keys to the user
 * @param {string}              jwtToken      Users JWT token
 * @param {PublicKey}           userPublicKey Users master public key
 * @param {TransformKey}        transformKey  Device transform key
 * @param {Uint8Array}          signature     Signature for device add request
 * @param {number}              timestamp     Timestamp of signature generation
 * @param {DeviceCreateOptions} options       Device create options.
 */
function userDeviceAdd(
    jwtToken: string,
    userPublicKey: PublicKey<Buffer>,
    transformKey: TransformKey,
    signature: Buffer,
    timestamp: number,
    options: DeviceCreateOptions
) {
    return {
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
    };
}

/**
 * Generate API request details for user key list request
 * @param {MessageSignature} sign     Signed message to verify the current user
 * @param {string[]}         userList List of user IDs to retrieve
 */
function userKeyList(sign: MessageSignature, userList: string[]) {
    return {
        url: `users?id=${encodeURIComponent(userList.join(","))}`,
        options: {
            method: "GET",
            headers: {
                Authorization: ApiRequest.getAuthHeader(sign),
            },
        },
        errorCode: ErrorCodes.USER_KEY_LIST_REQUEST_FAILURE,
    };
}

/**
 * Request a users list of devices.
 */
function userDeviceList(sign: MessageSignature, accountID: string) {
    return {
        url: `users/${encodeURIComponent(accountID)}/devices`,
        options: {
            method: "GET",
            headers: {
                Authorization: ApiRequest.getAuthHeader(sign),
            },
        },
        errorCode: ErrorCodes.USER_DEVICE_LIST_REQUEST_FAILURE,
    };
}

/**
 * Delete a users device keys
 */
function userDeviceDelete(sign: MessageSignature, accountID: string, deviceID?: number) {
    return {
        url: `users/${encodeURIComponent(accountID)}/devices/${deviceID || "current"}`,
        options: {
            method: "DELETE",
            headers: {
                Authorization: ApiRequest.getAuthHeader(sign),
            },
        },
        errorCode: ErrorCodes.USER_DEVICE_DELETE_REQUEST_FAILURE,
    };
}

export default {
    /**
     * One off API method to get the master public key for the user who the SDK is acting as.
     */
    getAccountContextPublicKey(accountID: string, segmentID: number, signingPrivateKey: Base64String) {
        const privateKeyBuffer = Codec.Buffer.fromBase64(signingPrivateKey);
        const signatureHeader = ApiRequest.createSignature(segmentID, accountID, {
            publicKey: computeEd25519PublicKey(privateKeyBuffer),
            privateKey: privateKeyBuffer,
        });

        const {url, options, errorCode} = userKeyList(signatureHeader, [accountID]);
        return ApiRequest.fetchJSON<UserKeyListResponseType>(url, errorCode, options);
    },

    /**
     * Invoke user verify API and maps result to determine if we got back a user or not
     * @param {string} jwt JWT token to pass to verify API
     */
    callUserVerifyApi(jwt: string): Future<SDKError, ApiServerUserResponse | undefined> {
        const {url, options, errorCode} = verify(jwt);
        return ApiRequest.fetchJSON<UserVerifyResponseType>(url, errorCode, options).map((data) => data || undefined);
    },

    /**
     * Invoke user create API with jwt and users public key and encrypted private key.
     */
    callUserCreateApi(jwt: string, userPublicKey: PublicKey<Buffer>, encryptedPrivateKey: Buffer): Future<SDKError, UserCreateResponseType> {
        const {url, options, errorCode} = userCreate(jwt, userPublicKey, encryptedPrivateKey);
        return ApiRequest.fetchJSON<UserCreateResponseType>(url, errorCode, options);
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
        return ApiRequest.fetchJSON<UserUpdateResponseType>(url, errorCode, options);
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
     * Make request to get a list of a users devices. Only ever works when acting as the currently authenticated user of the SDK.
     */
    callUserDeviceListApi(): Future<SDKError, UserDeviceListResponse> {
        const {accountID} = ApiState.accountAndSegmentIDs();
        const {url, options, errorCode} = userDeviceList(getSignatureHeader(), accountID);
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
