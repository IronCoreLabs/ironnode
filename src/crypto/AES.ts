import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import {tmpdir} from "os";
import Future from "futurejs";
import {StreamingEncryption, StreamingDecryption} from "./StreamingAES";
import * as Constants from "../Constants";
const {
    AES_IV_LENGTH,
    AES_GCM_TAG_LENGTH,
    AES_ALGORITHM,
    VERSION_HEADER_LENGTH,
    AES_SYMMETRIC_KEY_LENGTH,
    PBKDF2_SALT_LENGTH,
    HEADER_META_LENGTH_LENGTH,
    ErrorCodes,
} = Constants;
import SDKError from "../lib/SDKError";

/**
 * Compute an AES-256 symmetric key from the provided password and salt.
 */
function generatePasswordDerivedKey(password: string, salt: Buffer) {
    return new Future<SDKError, Buffer>((reject, resolve) => {
        crypto.pbkdf2(password, salt, Constants.PBKDF2_ITERATIONS(), AES_SYMMETRIC_KEY_LENGTH, "sha256", (error, derivedKey) => {
            if (error) {
                return reject(new SDKError(error, ErrorCodes.USER_MASTER_KEY_GENERATION_FAILURE));
            }
            resolve(derivedKey);
        });
    });
}

/**
 * Remove the leading header from the provided encrypted document. Determines the header version and strips off everything
 * up until the encrypted data IV bytes start. Returns any metadata that is present at the beginning of the document.
 */
function stripHeaderFromEncryptedDocument(document: Buffer) {
    if (document[0] === 1) {
        return document.slice(VERSION_HEADER_LENGTH);
    }
    //We already validate before this that the document is a valid version, so since we only have two versions, we can safely assume this is a v2 doc
    return document.slice(VERSION_HEADER_LENGTH + HEADER_META_LENGTH_LENGTH + document.readUInt16BE(VERSION_HEADER_LENGTH));
}

/**
 * Use the provided password to generate a symmetric key using PBKDF2 and encrypt the provided user master private key.
 */
export function encryptUserMasterKey(password: string, userMasterKey: Buffer) {
    const salt = crypto.randomBytes(PBKDF2_SALT_LENGTH);
    const iv = crypto.randomBytes(AES_IV_LENGTH);
    return generatePasswordDerivedKey(password, salt).map((derivedKey) => {
        const cipher = crypto.createCipheriv(AES_ALGORITHM, derivedKey, iv);
        return Buffer.concat([salt, iv, cipher.update(userMasterKey), cipher.final(), cipher.getAuthTag()]);
    });
}

/**
 * Decrypt the provided encrypted user master key with the provide password. Generates a derived key using PBKDF2 from the provided
 * password which is used to decrypt the encrypted master key.
 */
export function decryptUserMasterKey(password: string, encryptedUserMasterKey: Buffer) {
    const salt = encryptedUserMasterKey.slice(0, PBKDF2_SALT_LENGTH);
    const iv = encryptedUserMasterKey.slice(PBKDF2_SALT_LENGTH, AES_IV_LENGTH + PBKDF2_SALT_LENGTH);
    const encryptedKey = encryptedUserMasterKey.slice(AES_IV_LENGTH + PBKDF2_SALT_LENGTH, encryptedUserMasterKey.length - AES_GCM_TAG_LENGTH);
    const gcmTag = encryptedUserMasterKey.slice(encryptedUserMasterKey.length - AES_GCM_TAG_LENGTH);

    return generatePasswordDerivedKey(password, salt).flatMap((derivedKey) => {
        try {
            const decipher = crypto.createDecipheriv(AES_ALGORITHM, derivedKey, iv);
            decipher.setAuthTag(gcmTag);
            return Future.of(Buffer.concat([decipher.update(encryptedKey), decipher.final()]));
        } catch (e) {
            return Future.reject(new SDKError(new Error("User password was incorrect."), ErrorCodes.USER_PASSCODE_INCORRECT));
        }
    });
}

/**
 * Encrypt the provided document with the provided symmetric key. Will generate an IV and GCM tag and return as part of response.
 * @param {Buffer} documentHeader       Document version and metadata header
 * @param {Buffer} document             Document to encrypt
 * @param {Buffer} documentSymmetricKey Symmetric key to use for encryption
 */
export function encryptBytes(documentHeader: Buffer, document: Buffer, documentSymmetricKey: Buffer): Future<SDKError, Buffer> {
    try {
        const iv = crypto.randomBytes(AES_IV_LENGTH);
        const cipher = crypto.createCipheriv(AES_ALGORITHM, documentSymmetricKey, iv);
        return Future.of(Buffer.concat([documentHeader, iv, cipher.update(document), cipher.final(), cipher.getAuthTag()]));
    } catch (e) {
        return Future.reject(new SDKError(e, ErrorCodes.DOCUMENT_ENCRYPT_FAILURE));
    }
}

/**
 * Encrypt a stream given a readable input stream and a writable output stream and using the provided document symmetric key.
 * @param {Buffer}         documentHeader       Document version and meta data
 * @param {ReadableStream} inputStream          Readable input stream (such as a file) to read from and encrypt contents
 * @param {WritableStream} outputStream         Writable output stream where encrypted results will be streamed
 * @param {Buffer}         documentSymmetricKey AES symmetric key to use for encryption
 */
export function encryptStream(documentHeader: Buffer, inputStream: NodeJS.ReadableStream, outputStream: NodeJS.WritableStream, documentSymmetricKey: Buffer) {
    const encryptionStream = new StreamingEncryption(documentHeader, documentSymmetricKey);

    return new Future<SDKError, undefined>((reject, resolve) => {
        const readOrWriteFailure = (e: Error) => reject(new SDKError(e, ErrorCodes.DOCUMENT_ENCRYPT_FAILURE));

        inputStream.on("error", readOrWriteFailure);
        outputStream.on("error", readOrWriteFailure);
        outputStream.on("finish", () => resolve(undefined));
        try {
            inputStream.pipe(encryptionStream.getEncryptionStream()).pipe(outputStream);
        } catch (e) {
            reject(new SDKError(e, ErrorCodes.DOCUMENT_ENCRYPT_FAILURE));
        }
    });
}

/**
 * Decrypt the provided encrypted document package (ciphertext, IV, GCM tag) with the provided symmetric key.
 * @param {Buffer} cipherText           Document content to decrypt
 * @param {Buffer} iv                   Document IV
 * @param {Buffer} gcmTag               Document GCM auth tag
 * @param {Buffer} documentSymmetricKey Symmetric key to use to decrypt
 */
export function decryptBytes(cipherText: Buffer, documentSymmetricKey: Buffer): Future<SDKError, Buffer> {
    const encryptedDocument = stripHeaderFromEncryptedDocument(cipherText);
    //The first byte of the document is the version byte. We don't need to use that yet so we just start stripping data
    //from the 2nd byte forward
    const iv = encryptedDocument.slice(0, AES_IV_LENGTH);
    const content = encryptedDocument.slice(AES_IV_LENGTH, encryptedDocument.length - AES_GCM_TAG_LENGTH);
    const gcmTag = encryptedDocument.slice(encryptedDocument.length - AES_GCM_TAG_LENGTH);

    try {
        const cipher = crypto.createDecipheriv(AES_ALGORITHM, documentSymmetricKey, iv);
        cipher.setAuthTag(gcmTag);
        return Future.of(Buffer.concat([cipher.update(content), cipher.final()]));
    } catch (e) {
        return Future.reject(new SDKError(e, ErrorCodes.DOCUMENT_DECRYPT_FAILURE));
    }
}

/**
 * Decrypt a stream given a readable input stream and a file path to write to. For AES-GCM we don't want to support
 * decryption to a WritableStream because we can't authenticate the data until the very end. Therefore we only support
 * decrypting to an actual file. During the actual streaming decryption we write the results to a temp file and when
 * we've validated that the decryption was properly authenticated then we move the temp file to the outfile location and
 * remove the temp file. If any failures occur we'll reject the Future and clean up any partial temp files that we've written to.
 * @param {ReadableStream} inputStream          Readable input stream (such as a file) of encrypted content to stream read an decrypt
 * @param {string}         outfile              Fully qualified path to file where contents will be written once decryption has been validated
 * @param {Buffer}         documentSymmetricKey AES symmetric key to decrypt document
 */
export function decryptStream(inputStream: NodeJS.ReadableStream, outfile: string, documentSymmetricKey: Buffer) {
    const decryptionStream = new StreamingDecryption(documentSymmetricKey);
    //Create a temp file in a temp directory within the OS default temp dir
    const tempDirectoryName = path.join(fs.realpathSync(tmpdir()), crypto.randomBytes(16).toString("hex"));
    fs.mkdirSync(tempDirectoryName);
    const tempFileName = path.join(tempDirectoryName, crypto.randomBytes(16).toString("hex"));
    const tempWritable = fs.createWriteStream(tempFileName);

    return new Future<SDKError, undefined>((reject, resolve) => {
        const readOrWriteFailure = (e: Error) => {
            tempWritable.close();
            fs.rmdirSync(tempDirectoryName);
            reject(new SDKError(e, ErrorCodes.DOCUMENT_DECRYPT_FAILURE));
        };
        inputStream.on("error", readOrWriteFailure);
        tempWritable.on("error", readOrWriteFailure);
        tempWritable.on("finish", () => {
            try {
                fs.renameSync(tempFileName, outfile);
                fs.rmdirSync(tempDirectoryName);
                resolve(undefined);
            } catch (e) {
                reject(new SDKError(e, ErrorCodes.DOCUMENT_DECRYPT_FAILURE));
            }
        });

        try {
            inputStream.pipe(decryptionStream.getDecryptionStream()).pipe(tempWritable);
        } catch (e) {
            readOrWriteFailure(e);
        }
    });
}
