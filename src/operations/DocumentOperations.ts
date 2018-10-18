import Future from "futurejs";
import DocumentApi, {DocumentAccessResponseType} from "../api/DocumentApi";
import UserApi, {UserKeyListResponseType} from "../api/UserApi";
import GroupApi, {GroupListResponseType} from "../api/GroupApi";
import SDKError from "../lib/SDKError";
import {Codec} from "../lib/Utils";
import * as DocumentCrypto from "./DocumentCrypto";
import {DocumentMetaResponse, DecryptedDocumentResponse, DocumentAccessResponse} from "../../ironnode";
import {ErrorCodes, UserAndGroupTypes} from "../Constants";
import ApiState from "../lib/ApiState";
import {UserOrGroup} from "../commonTypes";

/**
 * Get a list of user and group keys for the provided users and then also add in the current account to the list of user keys
 * @param {string[]} userGrants  List of users to get public keys for
 * @param {string[]} groupGrants List of groups to get public keys for
 */
function getKeyListsForUsersAndGroups(
    userGrants: string[],
    groupGrants: string[]
): Future<SDKError, {userKeys: UserKeyListResponseType; groupKeys: GroupListResponseType}> {
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
        //Add in the current user to the list of users as we always encrypt new documents to the author directly
        return Future.of({
            userKeys: {result: [...userKeys.result, {id: accountID, userMasterPublicKey: Codec.PublicKey.toBase64(ApiState.accountPublicKey())}]},
            groupKeys,
        });
    });
}

/**
 * Take the result of listing a user/groups public keys and normalize them into a similar structure.
 */
function normalizeUserAndGroupPublicKeyList(userKeys: UserKeyListResponseType, groupKeys: GroupListResponseType) {
    return [
        userKeys.result.map((user) => ({id: user.id, masterPublicKey: user.userMasterPublicKey})),
        groupKeys.result.map((group) => ({id: group.id, masterPublicKey: group.groupMasterPublicKey})),
    ];
}

/**
 * Convert list of successful and failed access changes into mapped result that we expose from the SDK.
 */
function accessResultToAccessResponse(
    succeededIDs: Array<{userOrGroup: UserOrGroup}>,
    failedIDs: Array<{userOrGroup: UserOrGroup; errorMessage: string}>
): DocumentAccessResponse {
    return {
        succeeded: succeededIDs.map(({userOrGroup}) => ({
            id: userOrGroup.id,
            type: userOrGroup.type,
        })),
        failed: failedIDs.map(({userOrGroup, errorMessage}) => ({
            id: userOrGroup.id,
            type: userOrGroup.type,
            error: errorMessage,
        })),
    };
}

/**
 * Take the list of requested access change entities, the list of successful and failed operations, and the type of entity we're dealing with. Then iterate over the list of requested
 * entities to filter out the ones that weren't found in either the success nor failed arrays. Then map that resulting list to an array of objects that represent a failed
 * operation.
 */
function missingEntitiesToFailures(
    entityList: string[],
    successfulList: Array<{userOrGroup: UserOrGroup}>,
    failureList: Array<{userOrGroup: UserOrGroup}>,
    type: "user" | "group"
) {
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
}

/**
 * Format access change response to build up a list of successful and failed access changes. Resulting lists will have both users and groups, discriminated via
 * the type field. All failures will also contain an error string as well as the ID and type.
 * @param {DocumentAccessResponseType} accessChangeResult   Result from document grant/revoke request API
 * @param {string[]}                   requestedUserAccess  List of user IDs the user requested to change access
 * @param {string[]}                   requestedGroupAccess List of groupIDs the user requested to change access
 */
function accessResponseToSDKResult(accessChangeResult: DocumentAccessResponseType, requestedUserAccess: string[], requestedGroupAccess: string[]) {
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
}

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
    }));
}

/**
 * Create a new encrypted document. Use the provided ID and name to create it and encrypt it to the provided users and groups as well
 * as the currently authenticated account.
 */
export function encryptBytes(documentID: string, document: Buffer, documentName: string, userGrants: string[], groupGrants: string[]) {
    return getKeyListsForUsersAndGroups(userGrants, groupGrants)
        .flatMap(({userKeys, groupKeys}) => {
            const [userPublicKeys, groupPublicKeys] = normalizeUserAndGroupPublicKeyList(userKeys, groupKeys);
            return DocumentCrypto.encryptBytes(document, userPublicKeys, groupPublicKeys, ApiState.signingKeys().privateKey);
        })
        .flatMap(({userAccessKeys, groupAccessKeys, encryptedDocument}) => {
            return DocumentApi.callDocumentCreateApi(documentID, userAccessKeys, groupAccessKeys, documentName).map((createdDocument) => ({
                createdDocument,
                encryptedDocument,
            }));
        })
        .map(({createdDocument, encryptedDocument}) => ({
            documentID: createdDocument.id,
            documentName: createdDocument.name,
            document: encryptedDocument,
        }));
}

/**
 * Encrypt a stream of data and write it out to the provided writable stream. Optionally will share the document with the provided users and groups.
 */
export function encryptStream(
    documentID: string,
    inputStream: NodeJS.ReadableStream,
    outputStream: NodeJS.WritableStream,
    documentName: string,
    userGrants: string[],
    groupGrants: string[]
) {
    return getKeyListsForUsersAndGroups(userGrants, groupGrants)
        .flatMap(({userKeys, groupKeys}) => {
            const [userPublicKeys, groupPublicKeys] = normalizeUserAndGroupPublicKeyList(userKeys, groupKeys);
            return DocumentCrypto.encryptStream(inputStream, outputStream, userPublicKeys, groupPublicKeys, ApiState.signingKeys().privateKey);
        })
        .flatMap(({userAccessKeys, groupAccessKeys}) => DocumentApi.callDocumentCreateApi(documentID, userAccessKeys, groupAccessKeys, documentName))
        .map((createdDocument) => ({
            documentID: createdDocument.id,
            documentName: createdDocument.name,
        }));
}

/**
 * Decrypt the provided encrypted document given it's ID and content as bytes.
 */
export function decryptBytes(documentID: string, encryptedDocument: Buffer): Future<SDKError, DecryptedDocumentResponse> {
    return DocumentApi.callDocumentMetadataGetApi(documentID).flatMap((documentResponse) => {
        return DocumentCrypto.decryptBytes(encryptedDocument, documentResponse.encryptedSymmetricKey, ApiState.devicePrivateKey()).map((decryptedDocument) => ({
            documentID,
            documentName: documentResponse.name,
            visibleTo: documentResponse.visibleTo,
            data: decryptedDocument,
            association: documentResponse.association.type,
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
            return DocumentCrypto.reEncryptBytes(newDocumentData, documentResponse.encryptedSymmetricKey, ApiState.devicePrivateKey()).map((updatedDoc) => ({
                updatedDoc,
                documentResponse,
            }));
        })
        .map(({updatedDoc, documentResponse}) => ({
            documentID: documentResponse.id,
            documentName: documentResponse.name,
            document: updatedDoc,
        }));
}

/**
 * Update the encrypted data of the provided document stream specified by ID. Decrypts the existing documents symmetric key and reuses
 * it to encrypt the new document to the provided writable stream with a new IV.
 */
export function updateDocumentStream(documentID: string, inputStream: NodeJS.ReadableStream, outputStream: NodeJS.WritableStream) {
    return DocumentApi.callDocumentMetadataGetApi(documentID).flatMap((documentResponse) => {
        return DocumentCrypto.reEncryptStream(inputStream, outputStream, documentResponse.encryptedSymmetricKey, ApiState.devicePrivateKey()).map(() => ({
            documentID: documentResponse.id,
            documentName: documentResponse.name,
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
