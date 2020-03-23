"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Constants_1 = require("../Constants");
const AES_1 = require("../crypto/AES");
const Recrypt_1 = require("../crypto/Recrypt");
const SDKError_1 = require("../lib/SDKError");
function rotateUsersPrivateKey(password, encryptedPrivateKey) {
    return AES_1.decryptUserMasterKey(password, encryptedPrivateKey).flatMap(({ decryptedPrivateKey, derivedKey, derivedKeySalt }) => Recrypt_1.rotateUsersPrivateKeyWithRetry(decryptedPrivateKey)
        .errorMap((error) => new SDKError_1.default(error, Constants_1.ErrorCodes.USER_PRIVATE_KEY_ROTATION_FAILURE))
        .map(({ newPrivateKey, augmentationFactor }) => ({
        newEncryptedPrivateUserKey: AES_1.encryptUserMasterKeyWithExistingDerivedKey(newPrivateKey, derivedKey, derivedKeySalt),
        augmentationFactor,
    })));
}
exports.rotateUsersPrivateKey = rotateUsersPrivateKey;
function reencryptUserMasterPrivateKey(encryptedPrivateUserKey, currentPassword, newPassword) {
    return AES_1.decryptUserMasterKey(currentPassword, encryptedPrivateUserKey)
        .flatMap(({ decryptedPrivateKey }) => AES_1.encryptUserMasterKey(newPassword, decryptedPrivateKey))
        .errorMap((e) => new SDKError_1.default(e.rawError, Constants_1.ErrorCodes.USER_PASSCODE_CHANGE_FAILURE));
}
exports.reencryptUserMasterPrivateKey = reencryptUserMasterPrivateKey;
