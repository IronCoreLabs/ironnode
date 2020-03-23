import Future from "futurejs";
import {DecryptedDocumentResponse, DocumentAccessResponse, DocumentMetaResponse} from "../../ironnode";
import DocumentApi, {DocumentAccessResponseType} from "../api/DocumentApi";
import GroupApi, {GroupListResponseType} from "../api/GroupApi";
import UserApi, {UserKeyListResponseType} from "../api/UserApi";
import {DocumentHeader, UserOrGroup} from "../commonTypes";
import {ErrorCodes, HEADER_META_LENGTH_LENGTH, UserAndGroupTypes, VERSION_HEADER_LENGTH} from "../Constants";
import ApiState from "../lib/ApiState";
import SDKError from "../lib/SDKError";
import {Codec, generateDocumentHeaderBytes} from "../lib/Utils";
import * as DocumentCrypto from "./DocumentCrypto";

/**
 * Get a list of user and group keys for the provided users and then also add in the current account to the list of user keys
 * @param {string[]} userGrants  List of users to get public keys for
 * @param {string[]} groupGrants List of groups to get public keys for
 * @param {boolean}  encryptToAuthor True if the document should be encrypted to the user making the SDK call.
 */
const getKeyListsForUsersAndGroups = (
    userGrants: string[],
    groupGrants: string[],
    encryptToAuthor: boolean
): Future<SDKError, {userKeys: UserKeyListResponseType; groupKeys: GroupListResponseType}> => {
    const {accountID} = ApiState.accountAndSegmentIDs();
    return Future.gather2(UserApi.callUserKeyListApi(userGrants), GroupApi.callGroupKeyListApi(groupGrants)).flatMap(([userKeys, groupKeys]) => {
        if (userKeys.result.length !== userGrants.length || groupKeys.result.length !== groupGrants.length) {
            //One of the user or groups in the list here doesn't exist. Fail the create call.
            const existingUserIDs = userKeys.result.map(({id}) => id);
            const existingGroupIDs = groupKeys.result.map(({id}) => id);
            const missingUsers = userGrants.filter((userID) => existingUserIDs.indexOf(userID) === -1).join(",");
            const missingGroups = groupGrants.filter((groupID) => existingGroupIDs.indexOf(groupID) === -1).join(",");
            return Future.reject(
                new SDKError(
                    new Error(
                        `Failed to create document due to unknown users or groups in access list. Missing user IDs: [${missingUsers}]. Missing group IDs: [${missingGroups}]`
                    ),
                    ErrorCodes.DOCUMENT_CREATE_WITH_ACCESS_FAILURE
                )
            );
        }
        //Optionally add the user who is making this SDK call to the list of users to encrypt to
        const currentUser = encryptToAuthor ? [{id: accountID, userMasterPublicKey: Codec.PublicKey.toBase64(ApiState.accountPublicKey())}] : [];
        if (groupKeys.result.length === 0 && userKeys.result.length === 0 && currentUser.length === 0) {
            return Future.reject(new SDKError(new Error("No users or groups were provided to encrypt document to."), ErrorCodes.DOCUMENT_ENCRYPT_FAILURE));
        }
        return Future.of({
            userKeys: {result: [...userKeys.result, ...currentUser]},
            groupKeys,
        });
    });
};

/**
 * Take the result of listing a user/groups public keys and normalize them into a similar structure.
 */
const normalizeUserAndGroupPublicKeyList = (userKeys: UserKeyListResponseType, groupKeys: GroupListResponseType) => [
    userKeys.result.map((user) => ({id: user.id, masterPublicKey: user.userMasterPublicKey})),
    groupKeys.result.map((group) => ({id: group.id, masterPublicKey: group.groupMasterPublicKey})),
];

/**
 * Convert list of successful and failed access changes into mapped result that we expose from the SDK.
 */
const accessResultToAccessResponse = (
    succeededIDs: Array<{userOrGroup: UserOrGroup}>,
    failedIDs: Array<{userOrGroup: UserOrGroup; errorMessage: string}>
): DocumentAccessResponse => ({
    succeeded: succeededIDs.map(({userOrGroup}) => ({
        id: userOrGroup.id,
        type: userOrGroup.type,
    })),
    failed: failedIDs.map(({userOrGroup, errorMessage}) => ({
        id: userOrGroup.id,
        type: userOrGroup.type,
        error: errorMessage,
    })),
});

/**
 * Take the list of requested access change entities, the list of successful and failed operations, and the type of entity we're dealing with. Then iterate over the list of requested
 * entities to filter out the ones that weren't found in either the success nor failed arrays. Then map that resulting list to an array of objects that represent a failed
 * operation.
 */
const missingEntitiesToFailures = (
    entityList: string[],
    successfulList: Array<{userOrGroup: UserOrGroup}>,
    failureList: Array<{userOrGroup: UserOrGroup}>,
    type: "user" | "group"
) => {
    const matches = (id: string, {userOrGroup}: {userOrGroup: UserOrGroup}) => userOrGroup.type === type && userOrGroup.id === id;

    return entityList
        .filter((id) => {
            const doesMatch = matches.bind(null, id);
            return !successfulList.some(doesMatch) && !failureList.some(doesMatch);
        })
        .map((id) => ({
            id,
            type,
            error: "ID did not exist in the system.",
        }));
};

/**
 * Format access change response to build up a list of successful and failed access changes. Resulting lists will have both users and groups, discriminated via
 * the type field. All failures will also contain an error string as well as the ID and type.
 * @param {DocumentAccessResponseType} accessChangeResult   Result from document grant/revoke request API
 * @param {string[]}                   requestedUserAccess  List of user IDs the user requested to change access
 * @param {string[]}                   requestedGroupAccess List of groupIDs the user requested to change access
 */
const accessResponseToSDKResult = (accessChangeResult: DocumentAccessResponseType, requestedUserAccess: string[], requestedGroupAccess: string[]) => {
    const missingUsers = missingEntitiesToFailures(
        requestedUserAccess,
        accessChangeResult.succeededIds,
        accessChangeResult.failedIds,
        UserAndGroupTypes.USER as "user"
    );
    const missingGroups = missingEntitiesToFailures(
        requestedGroupAccess,
        accessChangeResult.succeededIds,
        accessChangeResult.failedIds,
        UserAndGroupTypes.GROUP as "group"
    );

    const mappedResults = accessResultToAccessResponse(accessChangeResult.succeededIds, accessChangeResult.failedIds);
    mappedResults.failed = mappedResults.failed.concat(missingUsers).concat(missingGroups);
    return mappedResults;
};

/**
 * Invoke document list API endpoint and map results to expected format
 */
export function list() {
    return DocumentApi.callDocumentListApi().map(({result}) => {
        return {
            result: result.map((document) => ({
                documentID: document.id,
                documentName: document.name,
                association: document.association.type,
                created: document.created,
                updated: document.updated,
            })),
        };
    });
}

/**
 * Invoke document meta get API endpoint and map results to expected format
 */
export function getMetadata(documentID: string): Future<SDKError, DocumentMetaResponse> {
    return DocumentApi.callDocumentMetadataGetApi(documentID).map((docMeta) => ({
        documentID: docMeta.id,
        documentName: docMeta.name,
        association: docMeta.association.type,
        visibleTo: docMeta.visibleTo,
        created: docMeta.created,
        updated: docMeta.updated,
    }));
}

/**
 * Given an encrypted document, attempt to parse the encrypted document header and return the ID of the document. Will only return the document
 * ID if present in the document header. For version 1 docs, where we didn't have the ID in the header, this method will return null.
 * @param encryptedDocument Encrypted document content to parse.
 */
export function getDocumentIDFromBytes(encryptedDocument: Buffer): Future<SDKError, string | null> {
    if (encryptedDocument[0] === 1) {
        return Future.of(null);
    }
    //Early bail if the bytes we got aren't one of our supported versions. This might mean what they're passing us isn't an IronCore encrypted file
    if (encryptedDocument[0] !== 2) {
        return Future.reject(
            new SDKError(new Error("File is not a supported version and may not be an encrypted file."), ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE)
        );
    }
    const headerLength = encryptedDocument.readUInt16BE(VERSION_HEADER_LENGTH);
    const headerString = encryptedDocument
        .slice(VERSION_HEADER_LENGTH + HEADER_META_LENGTH_LENGTH, VERSION_HEADER_LENGTH + HEADER_META_LENGTH_LENGTH + headerLength)
        .toString();
    try {
        const data: DocumentHeader = JSON.parse(headerString);
        return Future.of(data._did_);
    } catch (_) {
        return Future.reject(new SDKError(new Error("Unable to parse document header. Header value is corrupted."), ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE));
    }
}

/**
 * Given an encrypted document stream, read the minimal number of bytes necessary to try and parse the document ID from the front of
 * the encrypted document. For version 1 docs, where we didn't have the ID in the header, this method will return null.
 * @param inputStream Encrypted document input stream.
 */
export function getDocumentIDFromStream(inputStream: NodeJS.ReadableStream): Future<SDKError, string | null> {
    return new Future((reject, resolve) => {
        let hasRead = false; //This callback will get invoked multiple times since we do multiple read() calls. Ignore any past the first.
        inputStream.on("readable", () => {
            if (hasRead) {
                return;
            }
            hasRead = true;
            const versionAndHeader = inputStream.read(VERSION_HEADER_LENGTH + HEADER_META_LENGTH_LENGTH) as Buffer;
            if (!versionAndHeader) {
                return reject(new SDKError(new Error("Was not able to read from file."), ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE));
            }
            //Version 1 document, we don't have the document ID as it's not encoded in the header
            if (versionAndHeader[0] === 1) {
                return resolve(null);
            }
            //Check to see if the document is a version we don't support and reject if so
            if (versionAndHeader[0] !== 2) {
                return reject(
                    new SDKError(new Error("File is not a supported version and may not be an encrypted file."), ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE)
                );
            }
            const versionHeaderLength = versionAndHeader.readUInt16BE(VERSION_HEADER_LENGTH);
            const headerBytes = inputStream.read(versionHeaderLength);
            if (!headerBytes || headerBytes.length < versionHeaderLength) {
                return reject(new SDKError(new Error("Was not able to read from file or file is corrupted."), ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE));
            }
            try {
                const headerData: DocumentHeader = JSON.parse(headerBytes.toString());
                resolve(headerData._did_);
            } catch (_) {
                reject(new SDKError(new Error("File header could not be parsed."), ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE));
            }
        });
    });
}

/**
 * Create a new encrypted document. Use the provided ID and name to create it and encrypt it to the provided users and groups as well
 * as the currently authenticated account. Attempts to encrypt the bytes before creating the document within ironcore-id.
 */
export function encryptBytes(
    documentID: string,
    document: Buffer,
    documentName: string,
    userGrants: string[],
    groupGrants: string[],
    encryptToAuthor: boolean
) {
    return Future.gather2(getKeyListsForUsersAndGroups(userGrants, groupGrants, encryptToAuthor), DocumentCrypto.generateDocumentKeys())
        .flatMap(([{userKeys, groupKeys}, {documentPlaintext, documentSymmetricKey}]) => {
            const [userPublicKeys, groupPublicKeys] = normalizeUserAndGroupPublicKeyList(userKeys, groupKeys);
            const documentHeader = generateDocumentHeaderBytes(documentID, ApiState.accountAndSegmentIDs().segmentID);
            return Future.gather2(
                DocumentCrypto.encryptPlaintextToUsersAndGroups(documentPlaintext, userPublicKeys, groupPublicKeys, ApiState.signingKeys().privateKey),
                DocumentCrypto.encryptBytes(documentHeader, document, documentSymmetricKey)
            );
        })
        .flatMap(([createPayload, encryptedDocument]) => {
            return DocumentApi.callDocumentCreateApi(documentID, createPayload.userAccessKeys, createPayload.groupAccessKeys, documentName).map(
                (createdDocument) => ({
                    createdDocument,
                    encryptedDocument,
                })
            );
        })
        .map(({createdDocument, encryptedDocument}) => ({
            documentID: createdDocument.id,
            documentName: createdDocument.name,
            document: encryptedDocument,
            created: createdDocument.created,
            updated: createdDocument.updated,
        }));
}

/**
 * Encrypt a stream of data and write it out to the provided writable stream. Optionally will share the document with the provided users and groups. Creates
 * the document within ironcore-id before it starts encrypting the stream so that we don't end up streaming out encrypted content that we won't ever be able
 * to decrypt.
 */
export function encryptStream(
    documentID: string,
    inputStream: NodeJS.ReadableStream,
    outputStream: NodeJS.WritableStream,
    documentName: string,
    userGrants: string[],
    groupGrants: string[],
    encryptToAuthor: boolean
) {
    return Future.gather2(getKeyListsForUsersAndGroups(userGrants, groupGrants, encryptToAuthor), DocumentCrypto.generateDocumentKeys())
        .flatMap(([{userKeys, groupKeys}, {documentPlaintext, documentSymmetricKey}]) => {
            const [userPublicKeys, groupPublicKeys] = normalizeUserAndGroupPublicKeyList(userKeys, groupKeys);
            return DocumentCrypto.encryptPlaintextToUsersAndGroups(documentPlaintext, userPublicKeys, groupPublicKeys, ApiState.signingKeys().privateKey).map(
                (createPayload) => ({
                    createPayload,
                    documentSymmetricKey,
                })
            );
        })
        .flatMap(({createPayload, documentSymmetricKey}) => {
            return DocumentApi.callDocumentCreateApi(
                documentID,
                createPayload.userAccessKeys,
                createPayload.groupAccessKeys,
                documentName
            ).map((createdDocument) => ({createdDocument, documentSymmetricKey}));
        })
        .flatMap(({createdDocument, documentSymmetricKey}) => {
            const documentHeader = generateDocumentHeaderBytes(documentID, ApiState.accountAndSegmentIDs().segmentID);
            return DocumentCrypto.encryptStream(documentHeader, documentSymmetricKey, inputStream, outputStream).map(() => ({
                documentID: createdDocument.id,
                documentName: createdDocument.name,
                created: createdDocument.created,
                updated: createdDocument.updated,
            }));
        });
}

/**
 * Decrypt the provided encrypted document given it's ID and content as bytes.
 */
export function decryptBytes(documentID: string, encryptedDocument: Buffer): Future<SDKError, DecryptedDocumentResponse> {
    //Early verification to check that the bytes we got appear to be an IronCore encrypted document. We have two versions so reject early if the bytes provided
    //don't match either of those two versions.
    if (encryptedDocument[0] !== 1 && encryptedDocument[0] !== 2) {
        return Future.reject(
            new SDKError(new Error("Provided encrypted document doesn't appear to be valid. Invalid version."), ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE)
        );
    }
    return DocumentApi.callDocumentMetadataGetApi(documentID).flatMap((documentResponse) => {
        // tslint:disable-next-line:no-console
        console.log(`DocumentGet response: ${JSON.stringify(documentResponse)}`);
        return DocumentCrypto.decryptBytes(encryptedDocument, documentResponse.encryptedSymmetricKey, ApiState.devicePrivateKey()).map((decryptedDocument) => ({
            documentID,
            documentName: documentResponse.name,
            visibleTo: documentResponse.visibleTo,
            data: decryptedDocument,
            association: documentResponse.association.type,
            created: documentResponse.created,
            updated: documentResponse.updated,
        }));
    });
}

/**
 * Decrypt the provided encrypted stream given it's ID and write the results to the provided file upon completion and authentication.
 */
export function decryptStream(documentID: string, encryptedWriteStream: NodeJS.ReadableStream, outFile: string) {
    return DocumentApi.callDocumentMetadataGetApi(documentID).flatMap((documentResponse) => {
        return DocumentCrypto.decryptStream(encryptedWriteStream, outFile, documentResponse.encryptedSymmetricKey, ApiState.devicePrivateKey()).map(() => ({
            documentID,
            documentName: documentResponse.name,
            visibleTo: documentResponse.visibleTo,
            association: documentResponse.association.type,
            created: documentResponse.created,
            updated: documentResponse.updated,
        }));
    });
}

/**
 * Update the encrypted data of the document specified by ID. Decrypts the existing documents symmetric key and reuses it
 * to encrypt the new document with a new IV.
 */
export function updateDocumentBytes(documentID: string, newDocumentData: Buffer) {
    return DocumentApi.callDocumentMetadataGetApi(documentID)
        .flatMap((documentResponse) => {
            const documentHeader = generateDocumentHeaderBytes(documentID, ApiState.accountAndSegmentIDs().segmentID);
            return DocumentCrypto.reEncryptBytes(documentHeader, newDocumentData, documentResponse.encryptedSymmetricKey, ApiState.devicePrivateKey()).map(
                (updatedDoc) => ({
                    updatedDoc,
                    documentResponse,
                })
            );
        })
        .map(({updatedDoc, documentResponse}) => ({
            documentID: documentResponse.id,
            documentName: documentResponse.name,
            document: updatedDoc,
            created: documentResponse.created,
            updated: documentResponse.updated,
        }));
}

/**
 * Update the encrypted data of the provided document stream specified by ID. Decrypts the existing documents symmetric key and reuses
 * it to encrypt the new document to the provided writable stream with a new IV.
 */
export function updateDocumentStream(documentID: string, inputStream: NodeJS.ReadableStream, outputStream: NodeJS.WritableStream) {
    return DocumentApi.callDocumentMetadataGetApi(documentID).flatMap((documentResponse) => {
        const documentHeader = generateDocumentHeaderBytes(documentID, ApiState.accountAndSegmentIDs().segmentID);
        return DocumentCrypto.reEncryptStream(
            documentHeader,
            inputStream,
            outputStream,
            documentResponse.encryptedSymmetricKey,
            ApiState.devicePrivateKey()
        ).map(() => ({
            documentID: documentResponse.id,
            documentName: documentResponse.name,
            created: documentResponse.created,
            updated: documentResponse.updated,
        }));
    });
}

/**
 * Update a documents name to a new value or clear out the stored value
 */
export function updateDocumentName(documentID: string, documentName: string | null) {
    return DocumentApi.callDocumentUpdateApi(documentID, documentName).map((updatedDocument) => ({
        documentID: updatedDocument.id,
        documentName: updatedDocument.name,
        created: updatedDocument.created,
        updated: updatedDocument.updated,
    }));
}

/**
 * Grant access to an existing document with the list of users and/or groups provided.
 */
export function grantDocumentAccess(documentID: string, userGrants: string[], groupGrants: string[]): Future<SDKError, DocumentAccessResponse> {
    return Future.gather3(
        UserApi.callUserKeyListApi(userGrants),
        GroupApi.callGroupKeyListApi(groupGrants),
        DocumentApi.callDocumentMetadataGetApi(documentID)
    ).flatMap(([userKeys, groupKeys, documentMetadata]) => {
        //If we didn't get back keys for either users or groups, bail early
        if (!userKeys.result.length && !groupKeys.result.length) {
            return Future.of(accessResponseToSDKResult({succeededIds: [], failedIds: []}, userGrants, groupGrants));
        }
        //Otherwise decrypt the document key and encrypt it to each user/group
        const [userPublicKeys, groupPublicKeys] = normalizeUserAndGroupPublicKeyList(userKeys, groupKeys);
        return DocumentCrypto.encryptDocumentToKeys(
            documentMetadata.encryptedSymmetricKey,
            userPublicKeys,
            groupPublicKeys,
            ApiState.devicePrivateKey(),
            ApiState.signingKeys().privateKey
        )
            .flatMap((encryptedKeys) => DocumentApi.callDocumentGrantApi(documentID, encryptedKeys.userAccessKeys, encryptedKeys.groupAccessKeys))
            .map((accessResult) => accessResponseToSDKResult(accessResult, userGrants, groupGrants));
    });
}

/**
 * Revoke access to a document for the provided list of users and groups.
 */
export function revokeDocumentAccess(documentID: string, userRevocations: string[], groupRevocations: string[]) {
    return DocumentApi.callDocumentRevokeApi(documentID, userRevocations, groupRevocations).map(({succeededIds, failedIds}) =>
        accessResultToAccessResponse(succeededIds, failedIds)
    );
}
