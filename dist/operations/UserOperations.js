"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const UserApi_1 = require("../api/UserApi");
const ApiState_1 = require("../lib/ApiState");
const UserCrypto = require("./UserCrypto");
function getUserPublicKeys(userList) {
    return UserApi_1.default.callUserKeyListApi(userList).map((keyList) => {
        const publicKeysById = keyList.result.reduce((list, userKey) => {
            list[userKey.id] = userKey.userMasterPublicKey;
            return list;
        }, {});
        return userList.reduce((fullListResponse, requestedUserID) => {
            if (!fullListResponse[requestedUserID]) {
                fullListResponse[requestedUserID] = null;
            }
            return fullListResponse;
        }, publicKeysById);
    });
}
exports.getUserPublicKeys = getUserPublicKeys;
function getUserDevices() {
    return UserApi_1.default.callUserDeviceListApi();
}
exports.getUserDevices = getUserDevices;
function deleteUserDevice(deviceID) {
    return UserApi_1.default.callUserDeviceDeleteApi(deviceID);
}
exports.deleteUserDevice = deleteUserDevice;
function rotateMasterKey(password) {
    return UserCrypto.rotateUsersPrivateKey(password, ApiState_1.default.accountEncryptedPrivateKey()).flatMap(({ newEncryptedPrivateUserKey, augmentationFactor }) => UserApi_1.default.callUserKeyUpdateApi(newEncryptedPrivateUserKey, augmentationFactor).map(({ needsRotation }) => {
        ApiState_1.default.setEncryptedPrivateUserKey(newEncryptedPrivateUserKey);
        return { needsRotation };
    }));
}
exports.rotateMasterKey = rotateMasterKey;
function changeUsersPassword(currentPassword, newPassword) {
    return UserCrypto.reencryptUserMasterPrivateKey(ApiState_1.default.accountEncryptedPrivateKey(), currentPassword, newPassword).flatMap((newEncryptedPrivateKey) => UserApi_1.default.callUserUpdatePrivateKey(newEncryptedPrivateKey).map(() => {
        ApiState_1.default.setEncryptedPrivateUserKey(newEncryptedPrivateKey);
        return undefined;
    }));
}
exports.changeUsersPassword = changeUsersPassword;
