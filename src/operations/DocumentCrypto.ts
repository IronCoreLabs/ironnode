import Future from "futurejs";
import {ErrorCodes} from "../Constants";
import SDKError from "../lib/SDKError";
import * as Recrypt from "../crypto/Recrypt";
import * as AES from "../crypto/AES";
import {TransformedEncryptedMessage, UserOrGroupPublicKey, PrivateKey} from "../commonTypes";

/**
 * Generate a plaintext and an AES symmetric key that can be used to encrypt a new document.
 */
export function generateDocumentKeys() {
    return Recrypt.generateDocumentKey().map(([documentPlaintext, documentSymmetricKey]) => ({documentPlaintext, documentSymmetricKey}));
}

/**
 * Encrypt the provided document plaintext to the provided list of users and groups. Returns the encrypted user and group keys.
 */
export function encryptPlaintextToUsersAndGroups(
    documentPlaintext: Buffer,
    userKeyList: UserOrGroupPublicKey[],
    groupKeyList: UserOrGroupPublicKey[],
    privateSigningKey: PrivateKey<Buffer>
) {
    return Future.gather2(
        Recrypt.encryptPlaintextToList(documentPlaintext, userKeyList, privateSigningKey),
        Recrypt.encryptPlaintextToList(documentPlaintext, groupKeyList, privateSigningKey)
    )
        .map(([encryptedUserKeys, encryptedGroupKeys]) => ({
            userAccessKeys: encryptedUserKeys,
            groupAccessKeys: encryptedGroupKeys,
        }))
        .errorMap((error) => new SDKError(error, ErrorCodes.DOCUMENT_ENCRYPT_FAILURE));
}

/**
 * Encrypts the given bytes given the symmetric key to use for encryption. Prepends the provided document header to the front of the encrypted document.
 */
export function encryptBytes(documentHeader: Buffer, document: Buffer, documentSymmetricKey: Buffer) {
    return AES.encryptBytes(documentHeader, document, documentSymmetricKey).errorMap((error) => new SDKError(error, ErrorCodes.DOCUMENT_ENCRYPT_FAILURE));
}

/**
 * Encrypt a stream using the provided document symmetric key from the provided input stream and write it encrypted content to the provided output stream.
 */
export function encryptStream(documentHeader: Buffer, documentSymmetricKey: Buffer, inputStream: NodeJS.ReadableStream, outputStream: NodeJS.WritableStream) {
    return AES.encryptStream(documentHeader, inputStream, outputStream, documentSymmetricKey).errorMap(
        (error) => new SDKError(error, ErrorCodes.DOCUMENT_ENCRYPT_FAILURE)
    );
}

/**
 * Decrypt the provided encrypted document using the provided encrypted document symmetric key as well as the accounts private device key
 */
export function decryptBytes(encryptedDocument: Buffer, encryptedDocumentSymmetricKey: TransformedEncryptedMessage, devicePrivateKey: Buffer) {
    return Recrypt.decryptPlaintext(encryptedDocumentSymmetricKey, devicePrivateKey)
        .flatMap(([_, documentSymmetricKey]) => AES.decryptBytes(encryptedDocument, documentSymmetricKey))
        .errorMap((error) => new SDKError(error, ErrorCodes.DOCUMENT_DECRYPT_FAILURE));
}

/**
 * Decrypt the provided input read stream and write the contents to the provided file path once data has been fully decrypted and authenticated.
 */
export function decryptStream(
    encryptedReadStream: NodeJS.ReadableStream,
    outFile: string,
    encryptedDocumentSymmetricKey: TransformedEncryptedMessage,
    devicePrivateKey: Buffer
) {
    return Recrypt.decryptPlaintext(encryptedDocumentSymmetricKey, devicePrivateKey)
        .flatMap(([_, documentSymmetricKey]) => AES.decryptStream(encryptedReadStream, outFile, documentSymmetricKey))
        .errorMap((error) => new SDKError(error, ErrorCodes.DOCUMENT_DECRYPT_FAILURE));
}

/**
 * Encrypt a new document using the same symmetric key. Takes existing document data in order to decrypt the symmetric key, the generates a new document IV
 * and re-encrypts.
 */
export function reEncryptBytes(
    documentHeader: Buffer,
    newDocumentData: Buffer,
    existingDocumentSymmetricKey: TransformedEncryptedMessage,
    myPrivateKey: Buffer
) {
    return Recrypt.decryptPlaintext(existingDocumentSymmetricKey, myPrivateKey)
        .flatMap(([_, documentSymmetricKey]) => AES.encryptBytes(documentHeader, newDocumentData, documentSymmetricKey))
        .errorMap((error) => new SDKError(error, ErrorCodes.DOCUMENT_REENCRYPT_FAILURE));
}

/**
 * Encrypt a new document using the same symmetric key. Takes an existing document stream and decrypt the documents symmetric key, then generates a new document IV
 * and re-encrypts the stream to the provided writable out stream.
 */
export function reEncryptStream(
    documentHeader: Buffer,
    inputStream: NodeJS.ReadableStream,
    outputStream: NodeJS.WritableStream,
    existingDocumentSymmetricKey: TransformedEncryptedMessage,
    myPrivateKey: Buffer
) {
    return Recrypt.decryptPlaintext(existingDocumentSymmetricKey, myPrivateKey)
        .flatMap(([_, documentSymmetricKey]) => AES.encryptStream(documentHeader, inputStream, outputStream, documentSymmetricKey))
        .errorMap((error) => new SDKError(error, ErrorCodes.DOCUMENT_REENCRYPT_FAILURE));
}

/**
 * Grant document access by taking the document metadata and list of public keys of users/groups to grant acces to, decrypt the document symmetric key, and then reencrypt it
 * to the public keys of each of the users/groups to grant access to.
 */
export function encryptDocumentToKeys(
    symmetricKey: TransformedEncryptedMessage,
    userKeyList: UserOrGroupPublicKey[],
    groupKeyList: UserOrGroupPublicKey[],
    myPrivateKey: Buffer,
    privateSigningKey: PrivateKey<Buffer>
) {
    return Recrypt.decryptPlaintext(symmetricKey, myPrivateKey)
        .flatMap(([documentKeyPlaintext]) => {
            return Future.gather2(
                Recrypt.encryptPlaintextToList(documentKeyPlaintext, userKeyList, privateSigningKey),
                Recrypt.encryptPlaintextToList(documentKeyPlaintext, groupKeyList, privateSigningKey)
            ).map(([encryptedUserKeys, encryptedGroupKeys]) => ({
                userAccessKeys: encryptedUserKeys,
                groupAccessKeys: encryptedGroupKeys,
            }));
        })
        .errorMap((error) => new SDKError(error, ErrorCodes.DOCUMENT_GRANT_ACCESS_FAILURE));
}
