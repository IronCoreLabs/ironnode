"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const Constants_1 = require("../Constants");
const SDKError_1 = require("../lib/SDKError");
const Recrypt = require("../crypto/Recrypt");
const AES = require("../crypto/AES");
function generateDocumentKeys() {
    return Recrypt.generateDocumentKey().map(([documentPlaintext, documentSymmetricKey]) => ({ documentPlaintext, documentSymmetricKey }));
}
exports.generateDocumentKeys = generateDocumentKeys;
function encryptPlaintextToUsersAndGroups(documentPlaintext, userKeyList, groupKeyList, privateSigningKey) {
    return futurejs_1.default.gather2(Recrypt.encryptPlaintextToList(documentPlaintext, userKeyList, privateSigningKey), Recrypt.encryptPlaintextToList(documentPlaintext, groupKeyList, privateSigningKey))
        .map(([encryptedUserKeys, encryptedGroupKeys]) => ({
        userAccessKeys: encryptedUserKeys,
        groupAccessKeys: encryptedGroupKeys,
    }))
        .errorMap((error) => new SDKError_1.default(error, Constants_1.ErrorCodes.DOCUMENT_ENCRYPT_FAILURE));
}
exports.encryptPlaintextToUsersAndGroups = encryptPlaintextToUsersAndGroups;
function encryptBytes(documentHeader, document, documentSymmetricKey) {
    return AES.encryptBytes(documentHeader, document, documentSymmetricKey).errorMap((error) => new SDKError_1.default(error, Constants_1.ErrorCodes.DOCUMENT_ENCRYPT_FAILURE));
}
exports.encryptBytes = encryptBytes;
function encryptStream(documentHeader, documentSymmetricKey, inputStream, outputStream) {
    return AES.encryptStream(documentHeader, inputStream, outputStream, documentSymmetricKey).errorMap((error) => new SDKError_1.default(error, Constants_1.ErrorCodes.DOCUMENT_ENCRYPT_FAILURE));
}
exports.encryptStream = encryptStream;
function decryptBytes(encryptedDocument, encryptedDocumentSymmetricKey, devicePrivateKey) {
    return Recrypt.decryptPlaintext(encryptedDocumentSymmetricKey, devicePrivateKey)
        .flatMap(([_, documentSymmetricKey]) => AES.decryptBytes(encryptedDocument, documentSymmetricKey))
        .errorMap((error) => new SDKError_1.default(error, Constants_1.ErrorCodes.DOCUMENT_DECRYPT_FAILURE));
}
exports.decryptBytes = decryptBytes;
function decryptStream(encryptedReadStream, outFile, encryptedDocumentSymmetricKey, devicePrivateKey) {
    return Recrypt.decryptPlaintext(encryptedDocumentSymmetricKey, devicePrivateKey)
        .flatMap(([_, documentSymmetricKey]) => AES.decryptStream(encryptedReadStream, outFile, documentSymmetricKey))
        .errorMap((error) => new SDKError_1.default(error, Constants_1.ErrorCodes.DOCUMENT_DECRYPT_FAILURE));
}
exports.decryptStream = decryptStream;
function reEncryptBytes(documentHeader, newDocumentData, existingDocumentSymmetricKey, myPrivateKey) {
    return Recrypt.decryptPlaintext(existingDocumentSymmetricKey, myPrivateKey)
        .flatMap(([_, documentSymmetricKey]) => AES.encryptBytes(documentHeader, newDocumentData, documentSymmetricKey))
        .errorMap((error) => new SDKError_1.default(error, Constants_1.ErrorCodes.DOCUMENT_REENCRYPT_FAILURE));
}
exports.reEncryptBytes = reEncryptBytes;
function reEncryptStream(documentHeader, inputStream, outputStream, existingDocumentSymmetricKey, myPrivateKey) {
    return Recrypt.decryptPlaintext(existingDocumentSymmetricKey, myPrivateKey)
        .flatMap(([_, documentSymmetricKey]) => AES.encryptStream(documentHeader, inputStream, outputStream, documentSymmetricKey))
        .errorMap((error) => new SDKError_1.default(error, Constants_1.ErrorCodes.DOCUMENT_REENCRYPT_FAILURE));
}
exports.reEncryptStream = reEncryptStream;
function encryptDocumentToKeys(symmetricKey, userKeyList, groupKeyList, myPrivateKey, privateSigningKey) {
    return Recrypt.decryptPlaintext(symmetricKey, myPrivateKey)
        .flatMap(([documentKeyPlaintext]) => {
        return futurejs_1.default.gather2(Recrypt.encryptPlaintextToList(documentKeyPlaintext, userKeyList, privateSigningKey), Recrypt.encryptPlaintextToList(documentKeyPlaintext, groupKeyList, privateSigningKey)).map(([encryptedUserKeys, encryptedGroupKeys]) => ({
            userAccessKeys: encryptedUserKeys,
            groupAccessKeys: encryptedGroupKeys,
        }));
    })
        .errorMap((error) => new SDKError_1.default(error, Constants_1.ErrorCodes.DOCUMENT_GRANT_ACCESS_FAILURE));
}
exports.encryptDocumentToKeys = encryptDocumentToKeys;
