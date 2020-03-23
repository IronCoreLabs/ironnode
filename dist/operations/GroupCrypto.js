"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const Constants_1 = require("../Constants");
const Recrypt = require("../crypto/Recrypt");
const SDKError_1 = require("../lib/SDKError");
function createGroup(userPublicKey, privateSigningKey, addAsMember) {
    return Recrypt.generateGroupKeyPair()
        .flatMap(({ publicKey, plaintext, privateKey }) => {
        return futurejs_1.default.gather2(Recrypt.encryptPlaintext(plaintext, userPublicKey, privateSigningKey), addAsMember ? Recrypt.generateTransformKey(privateKey, userPublicKey, privateSigningKey) : futurejs_1.default.of(undefined)).map(([encryptedGroupKey, transformKey]) => ({
            encryptedGroupKey,
            groupPublicKey: publicKey,
            transformKey,
        }));
    })
        .errorMap((error) => new SDKError_1.default(error, Constants_1.ErrorCodes.GROUP_KEY_GENERATION_FAILURE));
}
exports.createGroup = createGroup;
function rotateGroupKey(encryptedGroupKey, adminList, userPrivateKey, signingKeys) {
    return Recrypt.decryptPlaintext(encryptedGroupKey, userPrivateKey)
        .flatMap(([, groupKey]) => Recrypt.rotateGroupPrivateKeyWithRetry(groupKey))
        .flatMap(({ plaintext, augmentationFactor }) => Recrypt.encryptPlaintextToList(plaintext, adminList, signingKeys.privateKey).map((encryptedAccessKeys) => ({
        encryptedAccessKeys,
        augmentationFactor,
    })))
        .errorMap((error) => new SDKError_1.default(error, Constants_1.ErrorCodes.GROUP_PRIVATE_KEY_ROTATION_FAILURE));
}
exports.rotateGroupKey = rotateGroupKey;
function addAdminsToGroup(encryptedGroupPrivateKey, userKeyList, adminPrivateKey, privateSigningKey) {
    return Recrypt.decryptPlaintext(encryptedGroupPrivateKey, adminPrivateKey)
        .flatMap(([plaintext]) => Recrypt.encryptPlaintextToList(plaintext, userKeyList, privateSigningKey))
        .errorMap((error) => new SDKError_1.default(error, Constants_1.ErrorCodes.GROUP_KEY_DECRYPTION_FAILURE));
}
exports.addAdminsToGroup = addAdminsToGroup;
function addMembersToGroup(groupPrivateKey, userKeyList, adminPrivateKey, privateSigningKey) {
    return Recrypt.decryptPlaintext(groupPrivateKey, adminPrivateKey)
        .flatMap(([_, key]) => Recrypt.generateTransformKeyToList(key, userKeyList, privateSigningKey))
        .errorMap((error) => new SDKError_1.default(error, Constants_1.ErrorCodes.GROUP_MEMBER_KEY_ENCRYPTION_FAILURE));
}
exports.addMembersToGroup = addMembersToGroup;
