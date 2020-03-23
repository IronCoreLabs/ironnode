"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const fs = require("fs");
const futurejs_1 = require("futurejs");
const os_1 = require("os");
const path = require("path");
const Constants = require("../Constants");
const SDKError_1 = require("../lib/SDKError");
const StreamingAES_1 = require("./StreamingAES");
const { AES_IV_LENGTH, AES_GCM_TAG_LENGTH, AES_ALGORITHM, VERSION_HEADER_LENGTH, AES_SYMMETRIC_KEY_LENGTH, PBKDF2_SALT_LENGTH, HEADER_META_LENGTH_LENGTH, ErrorCodes, } = Constants;
const generatePasswordDerivedKey = (password, salt) => new futurejs_1.default((reject, resolve) => {
    crypto.pbkdf2(password, salt, Constants.PBKDF2_ITERATIONS(), AES_SYMMETRIC_KEY_LENGTH, "sha256", (error, derivedKey) => {
        if (error) {
            return reject(new SDKError_1.default(error, ErrorCodes.USER_MASTER_KEY_GENERATION_FAILURE));
        }
        resolve(derivedKey);
    });
});
const stripHeaderFromEncryptedDocument = (document) => document[0] === 1
    ? document.slice(VERSION_HEADER_LENGTH)
    :
        document.slice(VERSION_HEADER_LENGTH + HEADER_META_LENGTH_LENGTH + document.readUInt16BE(VERSION_HEADER_LENGTH));
function encryptUserMasterKey(password, userMasterKey) {
    const salt = crypto.randomBytes(PBKDF2_SALT_LENGTH);
    const iv = crypto.randomBytes(AES_IV_LENGTH);
    return generatePasswordDerivedKey(password, salt).map((derivedKey) => {
        const cipher = crypto.createCipheriv(AES_ALGORITHM, derivedKey, iv);
        return Buffer.concat([salt, iv, cipher.update(userMasterKey), cipher.final(), cipher.getAuthTag()]);
    });
}
exports.encryptUserMasterKey = encryptUserMasterKey;
function encryptUserMasterKeyWithExistingDerivedKey(userMasterKey, derivedKey, derivedKeySalt) {
    const iv = crypto.randomBytes(AES_IV_LENGTH);
    const cipher = crypto.createCipheriv(AES_ALGORITHM, derivedKey, iv);
    return Buffer.concat([derivedKeySalt, iv, cipher.update(userMasterKey), cipher.final(), cipher.getAuthTag()]);
}
exports.encryptUserMasterKeyWithExistingDerivedKey = encryptUserMasterKeyWithExistingDerivedKey;
function decryptUserMasterKey(password, encryptedUserMasterKey) {
    const salt = encryptedUserMasterKey.slice(0, PBKDF2_SALT_LENGTH);
    const iv = encryptedUserMasterKey.slice(PBKDF2_SALT_LENGTH, AES_IV_LENGTH + PBKDF2_SALT_LENGTH);
    const encryptedKey = encryptedUserMasterKey.slice(AES_IV_LENGTH + PBKDF2_SALT_LENGTH, encryptedUserMasterKey.length - AES_GCM_TAG_LENGTH);
    const gcmTag = encryptedUserMasterKey.slice(encryptedUserMasterKey.length - AES_GCM_TAG_LENGTH);
    return generatePasswordDerivedKey(password, salt).flatMap((derivedKey) => {
        try {
            const decipher = crypto.createDecipheriv(AES_ALGORITHM, derivedKey, iv);
            decipher.setAuthTag(gcmTag);
            return futurejs_1.default.of({ decryptedPrivateKey: Buffer.concat([decipher.update(encryptedKey), decipher.final()]), derivedKey, derivedKeySalt: salt });
        }
        catch (e) {
            return futurejs_1.default.reject(new SDKError_1.default(new Error("User password was incorrect."), ErrorCodes.USER_PASSCODE_INCORRECT));
        }
    });
}
exports.decryptUserMasterKey = decryptUserMasterKey;
function encryptBytes(documentHeader, document, documentSymmetricKey) {
    try {
        const iv = crypto.randomBytes(AES_IV_LENGTH);
        const cipher = crypto.createCipheriv(AES_ALGORITHM, documentSymmetricKey, iv);
        return futurejs_1.default.of(Buffer.concat([documentHeader, iv, cipher.update(document), cipher.final(), cipher.getAuthTag()]));
    }
    catch (e) {
        return futurejs_1.default.reject(new SDKError_1.default(e, ErrorCodes.DOCUMENT_ENCRYPT_FAILURE));
    }
}
exports.encryptBytes = encryptBytes;
function encryptStream(documentHeader, inputStream, outputStream, documentSymmetricKey) {
    const encryptionStream = new StreamingAES_1.StreamingEncryption(documentHeader, documentSymmetricKey);
    return new futurejs_1.default((reject, resolve) => {
        const readOrWriteFailure = (e) => reject(new SDKError_1.default(e, ErrorCodes.DOCUMENT_ENCRYPT_FAILURE));
        inputStream.on("error", readOrWriteFailure);
        outputStream.on("error", readOrWriteFailure);
        outputStream.on("finish", () => resolve(undefined));
        try {
            inputStream.pipe(encryptionStream.getEncryptionStream()).pipe(outputStream);
        }
        catch (e) {
            reject(new SDKError_1.default(e, ErrorCodes.DOCUMENT_ENCRYPT_FAILURE));
        }
    });
}
exports.encryptStream = encryptStream;
function decryptBytes(cipherText, documentSymmetricKey) {
    const encryptedDocument = stripHeaderFromEncryptedDocument(cipherText);
    const iv = encryptedDocument.slice(0, AES_IV_LENGTH);
    const content = encryptedDocument.slice(AES_IV_LENGTH, encryptedDocument.length - AES_GCM_TAG_LENGTH);
    const gcmTag = encryptedDocument.slice(encryptedDocument.length - AES_GCM_TAG_LENGTH);
    try {
        const cipher = crypto.createDecipheriv(AES_ALGORITHM, documentSymmetricKey, iv);
        cipher.setAuthTag(gcmTag);
        return futurejs_1.default.of(Buffer.concat([cipher.update(content), cipher.final()]));
    }
    catch (e) {
        return futurejs_1.default.reject(new SDKError_1.default(e, ErrorCodes.DOCUMENT_DECRYPT_FAILURE));
    }
}
exports.decryptBytes = decryptBytes;
function decryptStream(inputStream, outfile, documentSymmetricKey) {
    const decryptionStream = new StreamingAES_1.StreamingDecryption(documentSymmetricKey);
    const tempDirectoryName = path.join(fs.realpathSync(os_1.tmpdir()), crypto.randomBytes(16).toString("hex"));
    fs.mkdirSync(tempDirectoryName);
    const tempFileName = path.join(tempDirectoryName, crypto.randomBytes(16).toString("hex"));
    const tempWritable = fs.createWriteStream(tempFileName);
    return new futurejs_1.default((reject, resolve) => {
        const readOrWriteFailure = (e) => {
            tempWritable.close();
            fs.rmdirSync(tempDirectoryName);
            reject(new SDKError_1.default(e, ErrorCodes.DOCUMENT_DECRYPT_FAILURE));
        };
        inputStream.on("error", readOrWriteFailure);
        tempWritable.on("error", readOrWriteFailure);
        tempWritable.on("finish", () => {
            try {
                fs.renameSync(tempFileName, outfile);
                fs.rmdirSync(tempDirectoryName);
                resolve(undefined);
            }
            catch (e) {
                reject(new SDKError_1.default(e, ErrorCodes.DOCUMENT_DECRYPT_FAILURE));
            }
        });
        try {
            inputStream.pipe(decryptionStream.getDecryptionStream()).pipe(tempWritable);
        }
        catch (e) {
            readOrWriteFailure(e);
        }
    });
}
exports.decryptStream = decryptStream;
