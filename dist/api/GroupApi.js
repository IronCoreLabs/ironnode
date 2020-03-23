"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const Constants_1 = require("../Constants");
const ApiState_1 = require("../lib/ApiState");
const Utils_1 = require("../lib/Utils");
const ApiRequest = require("./ApiRequest");
const getSignatureHeader = () => {
    const { segmentID, accountID } = ApiState_1.default.accountAndSegmentIDs();
    return ApiRequest.createSignature(segmentID, accountID, ApiState_1.default.signingKeys());
};
const groupList = (sign, groupIDList = []) => {
    const groupFilter = groupIDList.length ? `?id=${encodeURIComponent(groupIDList.join(","))}` : "";
    return {
        url: `groups${groupFilter}`,
        options: {
            method: "GET",
            headers: {
                Authorization: ApiRequest.getAuthHeader(sign),
            },
        },
        errorCode: Constants_1.ErrorCodes.GROUP_LIST_REQUEST_FAILURE,
    };
};
const groupGet = (sign, groupID) => ({
    url: `groups/${encodeURIComponent(groupID)}`,
    options: {
        method: "GET",
        headers: {
            Authorization: ApiRequest.getAuthHeader(sign),
        },
    },
    errorCode: Constants_1.ErrorCodes.GROUP_GET_REQUEST_FAILURE,
});
const groupCreate = (sign, groupID, createPayload) => {
    const userPublicKeyString = Utils_1.Codec.PublicKey.toBase64(createPayload.userPublicKey);
    let memberList;
    if (createPayload.transformKey) {
        memberList = [
            {
                userId: createPayload.userID,
                userMasterPublicKey: userPublicKeyString,
                transformKey: Utils_1.transformKeyToBase64(createPayload.transformKey),
            },
        ];
    }
    return {
        url: `groups`,
        options: {
            method: "POST",
            headers: {
                Authorization: ApiRequest.getAuthHeader(sign),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: groupID || undefined,
                name: createPayload.name || undefined,
                groupPublicKey: Utils_1.Codec.PublicKey.toBase64(createPayload.groupPublicKey),
                admins: [
                    Object.assign(Object.assign({}, createPayload.groupEncryptedPrivateKey), { user: {
                            userId: createPayload.userID,
                            userMasterPublicKey: userPublicKeyString,
                        } }),
                ],
                members: memberList,
                needsRotation: createPayload.needsRotation,
            }),
        },
        errorCode: Constants_1.ErrorCodes.GROUP_CREATE_REQUEST_FAILURE,
    };
};
const groupUpdate = (sign, groupID, groupName) => ({
    url: `groups/${encodeURIComponent(groupID)}`,
    options: {
        method: "PUT",
        headers: {
            Authorization: ApiRequest.getAuthHeader(sign),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name: groupName,
        }),
    },
    errorCode: Constants_1.ErrorCodes.GROUP_UPDATE_REQUEST_FAILURE,
});
const groupUpdateKey = (sign, groupId, groupKeyId, admins, augmentationFactor) => ({
    url: `groups/${encodeURIComponent(groupId)}/keys/${groupKeyId}`,
    options: {
        method: "PUT",
        headers: {
            Authorization: ApiRequest.getAuthHeader(sign),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            admins: admins.map((admin) => (Object.assign({ user: {
                    userId: admin.id,
                    userMasterPublicKey: admin.publicKey,
                } }, admin.encryptedPlaintext))),
            augmentationFactor: augmentationFactor.toString("base64"),
        }),
    },
    errorCode: Constants_1.ErrorCodes.GROUP_UPDATE_KEY_REQUEST_FAILURE,
});
const addAdmins = (sign, groupID, addedAdmins) => ({
    url: `groups/${encodeURIComponent(groupID)}/admins`,
    options: {
        method: "POST",
        headers: {
            Authorization: ApiRequest.getAuthHeader(sign),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            admins: addedAdmins.map((admin) => (Object.assign({ user: {
                    userId: admin.id,
                    userMasterPublicKey: admin.publicKey,
                } }, admin.encryptedPlaintext))),
        }),
    },
    errorCode: Constants_1.ErrorCodes.GROUP_ADD_ADMINS_REQUEST_FAILURE,
});
const removeAdmins = (sign, groupID, removedAdmins) => ({
    url: `groups/${encodeURIComponent(groupID)}/admins`,
    options: {
        method: "DELETE",
        headers: {
            Authorization: ApiRequest.getAuthHeader(sign),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            users: removedAdmins.map((userId) => ({ userId })),
        }),
    },
    errorCode: Constants_1.ErrorCodes.GROUP_REMOVE_ADMINS_REQUEST_FAILURE,
});
const addMembers = (sign, groupID, addedMembers) => ({
    url: `groups/${encodeURIComponent(groupID)}/users`,
    options: {
        method: "POST",
        headers: {
            Authorization: ApiRequest.getAuthHeader(sign),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            users: addedMembers.map((member) => ({
                userId: member.id,
                userMasterPublicKey: member.publicKey,
                transformKey: Utils_1.transformKeyToBase64(member.transformKey),
            })),
        }),
    },
    errorCode: Constants_1.ErrorCodes.GROUP_ADD_MEMBERS_REQUEST_FAILURE,
});
const removeMembers = (sign, groupID, removedMembers) => ({
    url: `groups/${encodeURIComponent(groupID)}/users`,
    options: {
        method: "DELETE",
        headers: {
            Authorization: ApiRequest.getAuthHeader(sign),
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            users: removedMembers.map((userId) => ({ userId })),
        }),
    },
    errorCode: Constants_1.ErrorCodes.GROUP_REMOVE_MEMBERS_REQUEST_FAILURE,
});
const groupDelete = (sign, groupID) => ({
    url: `groups/${encodeURIComponent(groupID)}`,
    options: {
        method: "DELETE",
        headers: {
            Authorization: ApiRequest.getAuthHeader(sign),
            "Content-Type": "application/json",
        },
    },
    errorCode: Constants_1.ErrorCodes.GROUP_DELETE_REQUEST_FAILURE,
});
exports.default = {
    callGroupListApi() {
        const { url, options, errorCode } = groupList(getSignatureHeader());
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callGroupKeyListApi(groupIDs) {
        if (!groupIDs.length) {
            return futurejs_1.default.of({ result: [] });
        }
        const { url, options, errorCode } = groupList(getSignatureHeader(), groupIDs);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callGroupGetApi(groupID) {
        const { url, options, errorCode } = groupGet(getSignatureHeader(), groupID);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callGroupCreateApi(groupID, groupPublicKey, groupEncryptedPrivateKey, groupName, transformKey, needsRotation) {
        const { url, options, errorCode } = groupCreate(getSignatureHeader(), groupID, {
            userID: ApiState_1.default.accountAndSegmentIDs().accountID,
            groupPublicKey,
            groupEncryptedPrivateKey,
            userPublicKey: ApiState_1.default.accountPublicKey(),
            name: groupName,
            transformKey,
            needsRotation,
        });
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callGroupUpdateApi(groupID, groupName) {
        const { url, options, errorCode } = groupUpdate(getSignatureHeader(), groupID, groupName);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callGroupUpdateKeyApi(groupId, groupKeyId, adminList, augmentationFactor) {
        const { url, options, errorCode } = groupUpdateKey(getSignatureHeader(), groupId, groupKeyId, adminList, augmentationFactor);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callAddAdminsApi(groupID, adminList) {
        const { url, options, errorCode } = addAdmins(getSignatureHeader(), groupID, adminList);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callRemoveAdminsApi(groupID, adminList) {
        const { url, options, errorCode } = removeAdmins(getSignatureHeader(), groupID, adminList);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callAddMembersApi(groupID, memberList) {
        const { url, options, errorCode } = addMembers(getSignatureHeader(), groupID, memberList);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callRemoveMembersApi(groupID, memberList) {
        const { url, options, errorCode } = removeMembers(getSignatureHeader(), groupID, memberList);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
    callGroupDeleteApi(groupID) {
        const { url, options, errorCode } = groupDelete(getSignatureHeader(), groupID);
        return ApiRequest.fetchJSON(url, errorCode, options);
    },
};
