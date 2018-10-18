import {DocumentCreateOptions, EncryptedDocumentResponse, DocumentAccessList} from "../../ironnode";
import * as DocumentOperations from "../operations/DocumentOperations";
import * as Utils from "../lib/Utils";

/**
 * Takes the document encrypt options object and normalizes it to a complete object with proper default values.
 * @param  {DocumentCreateOptions} options Options user passed in for document create operation
 * @return {DocumentCreateOptions}         Document create options object with properly filled out fields
 */
function calculateDocumentCreateOptionsDefault(options?: DocumentCreateOptions) {
    if (!options) {
        return {documentID: "", documentName: "", accessList: {users: [], groups: []}};
    }
    return {
        documentID: options.documentID || "",
        documentName: options.documentName || "",
        accessList: {
            users: options.accessList && options.accessList.users ? options.accessList.users : [],
            groups: options.accessList && options.accessList.groups ? options.accessList.groups : [],
        },
    };
}

/**
 * Returns the list of documents that the current user has access to decrypt. Only document metadata is returned, not any document content.
 * This list will include documents the user authored as well as documents that were granted access to the current user, either by another user or a group.
 */
export function list() {
    return DocumentOperations.list().toPromise();
}

/**
 * Get metadata about a document regardless of where the document content is stored. Returns a Promise which will be resolved with the document metadata.
 * @param {string} documentID ID of the document metadata to retrieve
 */
export function getMetadata(documentID: string) {
    Utils.validateID(documentID);
    return DocumentOperations.getMetadata(documentID).toPromise();
}

/**
 * Decrypt the provided document given the ID of the document and its data. Returns a Promise which will be resolved once the document has been successfully decrypted.
 * @param {string} documentID   Unique ID of document to decrypt
 * @param {Buffer} documentData Document data to decrypt
 */
export function decryptBytes(documentID: string, encryptedDocument: Buffer) {
    Utils.validateID(documentID);
    Utils.validateEncryptedDocument(encryptedDocument);
    return DocumentOperations.decryptBytes(documentID, encryptedDocument).toPromise();
}

/**
 * Decrypt the provided input stream given the ID of the document and write the resulting decrypted contents to the provided output file. The provided output file
 * must be a fully qualified path. Decryption cannot stream out to a WritableStream because documents are encrypted using AES-GCM which is a form of authenticated
 * decryption. Therefore it would be unsafe to write the decrypted bytes to a WritableStream before they have been decrypted. When the data has been fully decrypted
 * and authenticated it will then be written to the provided outputFilePath.
 * @param {string}         documentID     Unique ID of the document to decrypt
 * @param {ReadableStream} inputStream    Readable stream of encrypted document content
 * @param {string}         outputFilePath Location to write decrypted and authenticated data. Data will only be written to this file once decryption is fully complete
 *                                        when the Promise for this operation resolves.
 * NOT SUPPORTED UNTIL WE CAN DO SECURE AUTHENTICATED STREAMING DECRYPTION
 */
/*export function decryptStream(documentID: string, inputStream: NodeJS.ReadableStream, outputFilePath: string) {
    Utils.validateID(documentID);
    try {
        accessSync(dirname(outputFilePath), constants.W_OK);
    } catch (e) {
        throw new Error("Provided output file path is not writable.");
    }
    return DocumentOperations.decryptStream(documentID, inputStream, outputFilePath).toPromise();
}*/

/**
 * Encrypt the provided document. Returns a Promise which will be resolved once the content has been encrypted.
 * @param {Buffer}                documentData Contents of document to encrypt
 * @param {DocumentCreateOptions} options      Document create options. Includes:
 *                                               documentID: string - Optional ID to use for the document. Document ID will be stored unencrypted and must be unique per segment
 *                                               documentName: string - Optional name to provide to document. Document name will be stored unencrypted.
 *                                               accessList: object - Optional object which allows document to be shared with others upon creation. Contains the following keys:
 *                                                   users: Array - List of user IDs to share document with. Each value in the array should be in the form {id: string}.
 *                                                   groups: Array - List of group IDs to share document with. Each value in the array should be in the form {id: string}.
 */
export function encryptBytes(documentData: Buffer, options?: DocumentCreateOptions): Promise<EncryptedDocumentResponse> {
    Utils.validateDocumentData(documentData);
    const encryptOptions = calculateDocumentCreateOptionsDefault(options);
    if (encryptOptions.documentID) {
        Utils.validateID(encryptOptions.documentID);
    }
    const [userGrants, groupGrants] = Utils.dedupeAccessLists(encryptOptions.accessList);
    return DocumentOperations.encryptBytes(encryptOptions.documentID, documentData, encryptOptions.documentName, userGrants, groupGrants).toPromise();
}

/**
 * Encrypt the provided ReadableStream and write the resulting encrypted file to the provided WritableStream.
 * @param {ReadableStream}        inputStream  Readable stream of document content to encrypt
 * @param {WritableStream}        outputStream Writable stream of location to write encrypted document content as it's encrypted
 * @param {DocumentCreateOptions} options      Document create options. Includes:
 *                                               documentID: string - Optional ID to use for the document. Document ID will be stored unencrypted and must be unique per segment
 *                                               documentName: string - Optional name to provide to document. Document name will be stored unencrypted.
 *                                               accessList: object - Optional object which allows document to be shared with others upon creation. Contains the following keys:
 *                                                   users: Array - List of user IDs to share document with. Each value in the array should be in the form {id: string}.
 *                                                   groups: Array - List of group IDs to share document with. Each value in the array should be in the form {id: string}.
 */
export function encryptStream(inputStream: NodeJS.ReadableStream, outputStream: NodeJS.WritableStream, options?: DocumentCreateOptions) {
    const encryptOptions = calculateDocumentCreateOptionsDefault(options);
    if (encryptOptions.documentID) {
        Utils.validateID(encryptOptions.documentID);
    }
    const [userGrants, groupGrants] = Utils.dedupeAccessLists(encryptOptions.accessList);
    return DocumentOperations.encryptStream(
        encryptOptions.documentID,
        inputStream,
        outputStream,
        encryptOptions.documentName,
        userGrants,
        groupGrants
    ).toPromise();
}

/**
 * Update and re-encrypt a document that already exists. Returns a Promise which will be resolved once the new data has been encrypted.
 * @param {string} documentID      Unique ID of document to update
 * @param {Buffer} newDocumentData New content to encrypt for document
 */
export function updateEncryptedBytes(documentID: string, newDocumentData: Buffer): Promise<EncryptedDocumentResponse> {
    Utils.validateID(documentID);
    Utils.validateDocumentData(newDocumentData);
    return DocumentOperations.updateDocumentBytes(documentID, newDocumentData).toPromise();
}

/**
 * Update and re-encrypt a document that already exists. Reads data from the provided inputStream and writes encrypted content out to the provided
 * outputStream.
 * @param {string}         documentID   Unique ID of document to update
 * @param {ReadableStream} inputStream  Readable stream of content to encrypt
 * @param {WritableStream} outputStream Writable stream to write encrypted file contents to
 */
export function updateEncryptedStream(documentID: string, inputStream: NodeJS.ReadableStream, outputStream: NodeJS.WritableStream) {
    Utils.validateID(documentID);
    return DocumentOperations.updateDocumentStream(documentID, inputStream, outputStream).toPromise();
}

/**
 * Update a document name to a new value. Can also be used to clear the name field for an existing document by passing in null or an empty string for the name parameter.
 * @param {string}      documentID Unique ID of the document to update
 * @param {string|null} name       Name to update. Send in null/empty string to clear a documents name field.
 */
export function updateName(documentID: string, name: string | null) {
    Utils.validateID(documentID);
    return DocumentOperations.updateDocumentName(documentID, name).toPromise();
}

/**
 * Provides access to the provided list of users and groups to the provided document ID. Returns a Promise which will be resolved
 * once access to the document has been granted to all users/groups provided.
 * @param {string}             documentID Unique ID of document to grant access
 * @param {DocumentAccessList} accessList List of IDs (user IDs, group IDs) with which to grant document access
 */
export function grantAccess(documentID: string, grantList: DocumentAccessList) {
    Utils.validateID(documentID);
    Utils.validateAccessList(grantList);

    const [userGrants, groupGrants] = Utils.dedupeAccessLists(grantList);
    return DocumentOperations.grantDocumentAccess(documentID, userGrants, groupGrants).toPromise();
}

/**
 * Revoke access to a document from the provided list of user and/or group IDs. There are limitations on who is able to revoke document access. Document
 * authors can revoke access from any other user or group. Other users can revoke access that they created to other users or groups.
 * @param {string}             documentID Unique ID of document to revoke access
 * @param {DocumentAccessList} revokeList List of IDs (user IDs and/or groupIDs) from which to revoke access
 */
export function revokeAccess(documentID: string, revokeList: DocumentAccessList) {
    Utils.validateID(documentID);
    Utils.validateAccessList(revokeList);

    const [userRevocations, groupRevocations] = Utils.dedupeAccessLists(revokeList);
    return DocumentOperations.revokeDocumentAccess(documentID, userRevocations, groupRevocations).toPromise();
}
