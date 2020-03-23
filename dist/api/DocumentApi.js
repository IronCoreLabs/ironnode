"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Constants_1 = require("../Constants");
const ApiState_1 = require("../lib/ApiState");
const Utils_1 = require("../lib/Utils");
const ApiRequest = require("./ApiRequest");
function getSignatureHeader() {
    const { segmentID, accountID } = ApiState_1.default.accountAndSegmentIDs();
    return ApiRequest.createSignature(segmentID, accountID, ApiState_1.default.signingKeys());
}
function accessKeyToApiFormat(accessKeys, accessKeyType) {
    return accessKeys.map((accessKey) => (Object.assign(Object.assign({}, accessKey.encryptedPlaintext), { userOrGroup: {
            type: accessKeyType,
            id: accessKey.id,
            masterPublicKey: accessKey.publicKey,
        } })));
}
function documentList(sign) {
    return {
        url: `documents`,
        options: {
            method: "GET",
            headers: {
                Authorization: ApiRequest.getAuthHeader(sign),
            },
        },
        errorCode: Constants_1.ErrorCodes.DOCUMENT_LIST_REQUEST_FAILURE,
    };
}
function documentMetaGet(sign, documentID) {
    return {
        url: `documents/${encodeURIComponent(documentID)}`,
        options: {
            method: "GET",
            headers: {
                Authorization: ApiRequest.getAuthHeader(sign),
            },
        },
        errorCode: Constants_1.ErrorCodes.DOCUMENT_GET_REQUEST_FAILURE,
    };
}
function documentCreate(sign, documentID, payload) {
    const userGrantList = accessKeyToApiFormat(payload.userAccessKeys, Constants_1.UserAndGroupTypes.USER);
    const groupGrantList = accessKeyToApiFormat(payload.groupAccessKeys, Constants_1.UserAndGroupTypes.GROUP);
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
        errorCode: Constants_1.ErrorCodes.DOCUMENT_CREATE_REQUEST_FAILURE,
    };
}
function documentUpdate(sign, documentID, name) {
    return {
        url: `documents/${encodeURIComponent(documentID)}`,
        options: {
            method: "PUT",
            headers: {
                Authorization: ApiRequest.getAuthHeader(sign),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ name }),
        },
        errorCode: Constants_1.ErrorCodes.DOCUMENT_UPDATE_REQUEST_FAILURE,
    };
}
function documentGrant(sign, documentID, fromPublicKey, userGrants, groupGrants) {
    const userGrantList = accessKeyToApiFormat(userGrants, Constants_1.UserAndGroupTypes.USER);
    const groupGrantList = accessKeyToApiFormat(groupGrants, Constants_1.UserAndGroupTypes.GROUP);
    return {
        url: `documents/${encodeURIComponent(documentID)}/access`,
        options: {
            method: "POST",
            headers: {
                Authorization: ApiRequest.getAuthHeader(sign),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                fromPublicKey: Utils_1.Codec.PublicKey.toBase64(fromPublicKey),
                to: userGrantList.concat(groupGrantList),
            }),
        },
        errorCode: Constants_1.ErrorCodes.DOCUMENT_GRANT_ACCESS_REQUEST_FAILURE,
    };
}
function documentRevoke(sign, documentID, userRevocations, groupRevocations) {
    const users = userRevocations.map((userID) => ({ id: userID, type: Constants_1.UserAndGroupTypes.USER }));
    const groups = groupRevocations.map((groupID) => ({ id: groupID, type: Constants_1.UserAndGroupTypes.GROUP }));
    return {
        url: `documents/${encodeURIComponent(documentID)}/access`,
        options: {
            method: "DELETE",
            headers: {
                Authorization: ApiRequest.getAuthHeader(sign),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ userOrGroups: users.concat(groups) }),
        },
        errorCode: Constants_1.ErrorCodes.DOCUMENT_REVOKE_ACCESS_REQUEST_FAILURE,
    };
}
exports.default = {
    callDocumentListApi() {
        const { url, options, errorCode } = documentList(getSignatureHeader());
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callDocumentCreateApi(documentID, userAccessKeys, groupAccessKeys, documentName) {
        const { accountID } = ApiState_1.default.accountAndSegmentIDs();
        const { url, options, errorCode } = documentCreate(getSignatureHeader(), documentID, {
            userAccessKeys,
            groupAccessKeys,
            documentName,
            userID: accountID,
        });
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callDocumentMetadataGetApi(documentID) {
        const { url, options, errorCode } = documentMetaGet(getSignatureHeader(), documentID);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callDocumentUpdateApi(documentID, name) {
        const { url, options, errorCode } = documentUpdate(getSignatureHeader(), documentID, name);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callDocumentGrantApi(documentID, userAccessKeys, groupAccessKeys) {
        const { url, options, errorCode } = documentGrant(getSignatureHeader(), documentID, ApiState_1.default.accountPublicKey(), userAccessKeys, groupAccessKeys);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callDocumentRevokeApi(documentID, userRevocations, groupRevocations) {
        const { url, options, errorCode } = documentRevoke(getSignatureHeader(), documentID, userRevocations, groupRevocations);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
};
