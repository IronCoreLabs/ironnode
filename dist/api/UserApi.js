"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const Constants_1 = require("../Constants");
const Recrypt_1 = require("../crypto/Recrypt");
const ApiState_1 = require("../lib/ApiState");
const Utils_1 = require("../lib/Utils");
const ApiRequest = require("./ApiRequest");
const getSignatureHeader = () => {
    const { segmentID, accountID } = ApiState_1.default.accountAndSegmentIDs();
    return ApiRequest.createSignature(segmentID, accountID, ApiState_1.default.signingKeys());
};
const getCurrentUser = (sig) => ({
    url: `users/current`,
    options: {
        method: "GET",
        headers: {
            Authorization: ApiRequest.getAuthHeader(sig),
        },
    },
    errorCode: Constants_1.ErrorCodes.INITIALIZE_INVALID_ACCOUNT_ID,
});
const verify = (jwt) => ({
    url: `users/verify?returnKeys=true`,
    options: {
        headers: {
            Authorization: `jwt ${jwt}`,
        },
    },
    errorCode: Constants_1.ErrorCodes.USER_VERIFY_API_REQUEST_FAILURE,
});
const userCreate = (jwt, userPublicKey, encryptedUserPrivateKey, needsRotation) => ({
    url: `users`,
    options: {
        method: "POST",
        headers: {
            Authorization: `jwt ${jwt}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            userPublicKey: Utils_1.Codec.PublicKey.toBase64(userPublicKey),
            userPrivateKey: Utils_1.Codec.Buffer.toBase64(encryptedUserPrivateKey),
            needsRotation,
        }),
    },
    errorCode: Constants_1.ErrorCodes.USER_CREATE_REQUEST_FAILURE,
});
const userUpdateKey = (sig, userID, keyId, encryptedPrivateKey, augmentationFactor) => ({
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
    errorCode: Constants_1.ErrorCodes.USER_UPDATE_KEY_REQUEST_FAILURE,
});
const userDeviceAdd = (jwtToken, userPublicKey, transformKey, signature, timestamp, options) => ({
    url: `users/devices`,
    options: {
        method: "POST",
        headers: {
            Authorization: `jwt ${jwtToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            timestamp,
            userPublicKey: Utils_1.Codec.PublicKey.toBase64(userPublicKey),
            device: {
                transformKey: Utils_1.transformKeyToBase64(transformKey),
                name: options.deviceName || undefined,
            },
            signature: Utils_1.Codec.Buffer.toBase64(signature),
        }),
    },
    errorCode: Constants_1.ErrorCodes.USER_DEVICE_ADD_REQUEST_FAILURE,
});
const userKeyList = (sign, userList) => ({
    url: `users?id=${encodeURIComponent(userList.join(","))}`,
    options: {
        method: "GET",
        headers: {
            Authorization: ApiRequest.getAuthHeader(sign),
        },
    },
    errorCode: Constants_1.ErrorCodes.USER_KEY_LIST_REQUEST_FAILURE,
});
const userDeviceList = (sign, accountID) => ({
    url: `users/${encodeURIComponent(accountID)}/devices`,
    options: {
        method: "GET",
        headers: {
            Authorization: ApiRequest.getAuthHeader(sign),
        },
    },
    errorCode: Constants_1.ErrorCodes.USER_DEVICE_LIST_REQUEST_FAILURE,
});
const userDeviceDelete = (sign, accountID, deviceID) => ({
    url: `users/${encodeURIComponent(accountID)}/devices/${deviceID || "current"}`,
    options: {
        method: "DELETE",
        headers: {
            Authorization: ApiRequest.getAuthHeader(sign),
        },
    },
    errorCode: Constants_1.ErrorCodes.USER_DEVICE_DELETE_REQUEST_FAILURE,
});
const userUpdateEncryptedPrivateKey = (sign, accountId, encryptedPrivateKey) => ({
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
    errorCode: Constants_1.ErrorCodes.USER_UPDATE_REQUEST_FAILURE,
});
exports.default = {
    getAccountContextPublicKey(accountID, segmentID, signingPrivateKey) {
        const privateKeyBuffer = Utils_1.Codec.Buffer.fromBase64(signingPrivateKey);
        const signatureHeader = ApiRequest.createSignature(segmentID, accountID, {
            publicKey: Recrypt_1.computeEd25519PublicKey(privateKeyBuffer),
            privateKey: privateKeyBuffer,
        });
        const { url, options, errorCode } = getCurrentUser(signatureHeader);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callUserVerifyApi(jwt) {
        const { url, options, errorCode } = verify(jwt);
        return ApiRequest.fetchJSON(url, errorCode, options).map((data) => data || undefined);
    },
    callUserCreateApi(jwt, userPublicKey, encryptedPrivateKey, needsRotation) {
        const { url, options, errorCode } = userCreate(jwt, userPublicKey, encryptedPrivateKey, needsRotation);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callUserKeyUpdateApi(encryptedPrivateKey, augmentationFactor) {
        const { accountID } = ApiState_1.default.accountAndSegmentIDs();
        const keyId = ApiState_1.default.keyId();
        const { url, options, errorCode } = userUpdateKey(getSignatureHeader(), accountID, keyId, encryptedPrivateKey, augmentationFactor);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callUserDeviceAdd(jwtToken, userPublicKey, transformKey, signature, timestamp, createOptions) {
        const { url, options, errorCode } = userDeviceAdd(jwtToken, userPublicKey, transformKey, signature, timestamp, createOptions);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callUserKeyListApi(userList) {
        if (!userList.length) {
            return futurejs_1.default.of({ result: [] });
        }
        const { url, options, errorCode } = userKeyList(getSignatureHeader(), userList);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callUserUpdatePrivateKey(userEncryptedPrivateKey) {
        const { accountID } = ApiState_1.default.accountAndSegmentIDs();
        const { url, options, errorCode } = userUpdateEncryptedPrivateKey(getSignatureHeader(), accountID, userEncryptedPrivateKey);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callUserDeviceListApi() {
        const { url, options, errorCode } = userDeviceList(getSignatureHeader(), ApiState_1.default.accountAndSegmentIDs().accountID);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callUserDeviceDeleteApi(deviceID) {
        const { accountID } = ApiState_1.default.accountAndSegmentIDs();
        const { url, options, errorCode } = userDeviceDelete(getSignatureHeader(), accountID, deviceID);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
};
