import {ErrorCodes, UserAndGroupTypes} from "../Constants";
import {Codec} from "../lib/Utils";
import * as ApiRequest from "./ApiRequest";
import ApiState from "../lib/ApiState";
import {DocumentAssociation} from "../../ironnode";
import {TransformedEncryptedMessage, Base64String, UserOrGroup, EncryptedAccessKey, MessageSignature, PublicKey} from "../commonTypes";

interface DocumentMetaApiResponse {
    id: string;
    name: string;
    association: {
        type: DocumentAssociation;
    };
    created: string;
    updated: string;
}

export interface DocumentListResponseType {
    result: DocumentMetaApiResponse[];
}
export interface DocumentMetaGetResponseType extends DocumentMetaApiResponse {
    visibleTo: {
        users: Array<{id: string}>;
        groups: Array<{id: string; name?: string}>;
    };
    encryptedSymmetricKey: TransformedEncryptedMessage;
}
export interface DocumentGetResponseType extends DocumentMetaGetResponseType {
    data: {
        content: Base64String;
    };
}
export interface DocumentCreateResponseType {
    id: string;
    name: string;
    created: string;
    updated: string;
}
export type DocumentUpdateResponseType = DocumentGetResponseType;
export interface DocumentAccessResponseType {
    succeededIds: Array<{userOrGroup: UserOrGroup}>;
    failedIds: Array<{userOrGroup: UserOrGroup; errorMessage: string}>;
}

interface DocumentCreatePayload {
    userAccessKeys: EncryptedAccessKey[];
    groupAccessKeys: EncryptedAccessKey[];
    documentName?: string;
    userID: string;
}

/**
 * Generate signature message from current user state
 */
function getSignatureHeader() {
    const {segmentID, accountID} = ApiState.accountAndSegmentIDs();
    return ApiRequest.createSignature(segmentID, accountID, ApiState.signingKeys());
}

/**
 * Convert list of encrypted document access keys into format expected for document granting API endpoint
 * @param {EncryptedAccessKey[]} accessKeys    List of encrypted document keys and group/user public keys and ID
 * @param {string}               accessKeyType Type of entity access. Either user or group constant.
 */
function accessKeyToApiFormat(accessKeys: EncryptedAccessKey[], accessKeyType: string) {
    return accessKeys.map((accessKey) => ({
        ...accessKey.encryptedPlaintext,
        userOrGroup: {
            type: accessKeyType,
            id: accessKey.id,
            masterPublicKey: accessKey.publicKey,
        },
    }));
}

/**
 * Get API request details for document list
 * @param {MessageSignature} sign Signature for request validation
 */
function documentList(sign: MessageSignature) {
    return {
        url: `documents`,
        options: {
            method: "GET",
            headers: {
                Authorization: ApiRequest.getAuthHeader(sign),
            },
        },
        errorCode: ErrorCodes.DOCUMENT_LIST_REQUEST_FAILURE,
    };
}

/**
 * Get a specific document metadata by ID
 * @param {MessageSignature} sign           Signature for request validation
 * @param {string}           documentID     ID of document
 */
function documentMetaGet(sign: MessageSignature, documentID: string) {
    return {
        url: `documents/${encodeURIComponent(documentID)}`,
        options: {
            method: "GET",
            headers: {
                Authorization: ApiRequest.getAuthHeader(sign),
            },
        },
        errorCode: ErrorCodes.DOCUMENT_GET_REQUEST_FAILURE,
    };
}

/**
 * Create a new document
 */
function documentCreate(sign: MessageSignature, documentID: string, payload: DocumentCreatePayload) {
    const userGrantList = accessKeyToApiFormat(payload.userAccessKeys, UserAndGroupTypes.USER);
    const groupGrantList = accessKeyToApiFormat(payload.groupAccessKeys, UserAndGroupTypes.GROUP);
    return {
        url: `documents`,
        options: {
            method: "POST",
            headers: {
                Authorization: ApiRequest.getAuthHeader(sign),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: documentID || undefined,
                value: {
                    name: payload.documentName || undefined,
                    fromUserId: payload.userID,
                    sharedWith: userGrantList.concat(groupGrantList),
                },
            }),
        },
        errorCode: ErrorCodes.DOCUMENT_CREATE_REQUEST_FAILURE,
    };
}

/**
 * Update an existing documents name to a new name or clear out it's value.
 */
function documentUpdate(sign: MessageSignature, documentID: string, name?: string | null) {
    return {
        url: `documents/${encodeURIComponent(documentID)}`,
        options: {
            method: "PUT",
            headers: {
                Authorization: ApiRequest.getAuthHeader(sign),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({name}),
        },
        errorCode: ErrorCodes.DOCUMENT_UPDATE_REQUEST_FAILURE,
    };
}

/**
 * Grant access to a document with a list of other users and/or groups
 */
function documentGrant(
    sign: MessageSignature,
    documentID: string,
    fromPublicKey: PublicKey<Buffer>,
    userGrants: EncryptedAccessKey[],
    groupGrants: EncryptedAccessKey[]
) {
    const userGrantList = accessKeyToApiFormat(userGrants, UserAndGroupTypes.USER);
    const groupGrantList = accessKeyToApiFormat(groupGrants, UserAndGroupTypes.GROUP);
    return {
        url: `documents/${encodeURIComponent(documentID)}/access`,
        options: {
            method: "POST",
            headers: {
                Authorization: ApiRequest.getAuthHeader(sign),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                fromPublicKey: Codec.PublicKey.toBase64(fromPublicKey),
                to: userGrantList.concat(groupGrantList),
            }),
        },
        errorCode: ErrorCodes.DOCUMENT_GRANT_ACCESS_REQUEST_FAILURE,
    };
}

/**
 * Revoke access to a document from the provided list of users or groups.
 */
function documentRevoke(sign: MessageSignature, documentID: string, userRevocations: string[], groupRevocations: string[]) {
    const users = userRevocations.map((userID) => ({id: userID, type: UserAndGroupTypes.USER}));
    const groups = groupRevocations.map((groupID) => ({id: groupID, type: UserAndGroupTypes.GROUP}));

    return {
        url: `documents/${encodeURIComponent(documentID)}/access`,
        options: {
            method: "DELETE",
            headers: {
                Authorization: ApiRequest.getAuthHeader(sign),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({userOrGroups: users.concat(groups)}),
        },
        errorCode: ErrorCodes.DOCUMENT_REVOKE_ACCESS_REQUEST_FAILURE,
    };
}

export default {
    /**
     * Invokes the document list API
     */
    callDocumentListApi() {
        const {url, options, errorCode} = documentList(getSignatureHeader());
        return ApiRequest.fetchJSON<DocumentListResponseType>(url, errorCode, options);
    },

    /**
     * Invokes the document create API
     */
    callDocumentCreateApi(documentID: string, userAccessKeys: EncryptedAccessKey[], groupAccessKeys: EncryptedAccessKey[], documentName?: string) {
        const {accountID} = ApiState.accountAndSegmentIDs();
        const {url, options, errorCode} = documentCreate(getSignatureHeader(), documentID, {
            userAccessKeys,
            groupAccessKeys,
            documentName,
            userID: accountID,
        });
        return ApiRequest.fetchJSON<DocumentCreateResponseType>(url, errorCode, options);
    },

    /**
     * Get document metadata. Returns all document info except for the data and data nonce fields
     */
    callDocumentMetadataGetApi(documentID: string) {
        const {url, options, errorCode} = documentMetaGet(getSignatureHeader(), documentID);
        return ApiRequest.fetchJSON<DocumentMetaGetResponseType>(url, errorCode, options);
    },

    /**
     * Call document update API to update either the document data and/or name. If data is sent we only send the data and nonce as we don't update who the
     * document is encrypted to as part of this request. The document name field can also be set as null which will cause the name field to be cleared.
     */
    callDocumentUpdateApi(documentID: string, name?: string | null) {
        const {url, options, errorCode} = documentUpdate(getSignatureHeader(), documentID, name);
        return ApiRequest.fetchJSON<DocumentUpdateResponseType>(url, errorCode, options);
    },

    /**
     * Grant access to a document with the list of users and/or groups provided
     */
    callDocumentGrantApi(documentID: string, userAccessKeys: EncryptedAccessKey[], groupAccessKeys: EncryptedAccessKey[]) {
        const {url, options, errorCode} = documentGrant(getSignatureHeader(), documentID, ApiState.accountPublicKey(), userAccessKeys, groupAccessKeys);
        return ApiRequest.fetchJSON<DocumentAccessResponseType>(url, errorCode, options);
    },

    /**
     * Revoke access to a document given its ID from the provided list of user and/or group provided
     */
    callDocumentRevokeApi(documentID: string, userRevocations: string[], groupRevocations: string[]) {
        const {url, options, errorCode} = documentRevoke(getSignatureHeader(), documentID, userRevocations, groupRevocations);
        return ApiRequest.fetchJSON<DocumentAccessResponseType>(url, errorCode, options);
    },
};
