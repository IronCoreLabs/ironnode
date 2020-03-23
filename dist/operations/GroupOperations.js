"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const GroupApi_1 = require("../api/GroupApi");
const UserApi_1 = require("../api/UserApi");
const Constants_1 = require("../Constants");
const ApiState_1 = require("../lib/ApiState");
const SDKError_1 = require("../lib/SDKError");
const GroupCrypto = require("./GroupCrypto");
const isFullGroupResponse = (group) => Array.isArray(group.adminIds);
const isGroupAdminResponse = (group) => group.encryptedPrivateKey !== undefined;
function mapOperationToSuccessAndFailureList(requestedList, succeededIds, failedIDs) {
    const missingUserList = requestedList
        .filter((id) => {
        return !succeededIds.some(({ userId }) => id === userId) && !failedIDs.some(({ userId }) => id === userId);
    })
        .map((id) => ({ id, error: "ID did not exist in the system." }));
    return {
        succeeded: succeededIds.map(({ userId }) => userId),
        failed: failedIDs.map(({ userId, errorMessage }) => ({ id: userId, error: errorMessage })).concat(missingUserList),
    };
}
function formatDetailedGroupResponse(group) {
    const groupResponse = {
        groupID: group.id,
        groupName: group.name,
        isAdmin: group.permissions.indexOf(Constants_1.GroupPermissions.ADMIN) !== -1,
        isMember: group.permissions.indexOf(Constants_1.GroupPermissions.MEMBER) !== -1,
        created: group.created,
        updated: group.updated,
    };
    if (isFullGroupResponse(group)) {
        groupResponse.groupAdmins = group.adminIds;
        groupResponse.groupMembers = group.memberIds;
    }
    if (isGroupAdminResponse(group)) {
        groupResponse.needsRotation = group.needsRotation;
    }
    return groupResponse;
}
function list() {
    return GroupApi_1.default.callGroupListApi().map((groups) => ({
        result: groups.result.map(formatDetailedGroupResponse),
    }));
}
exports.list = list;
function get(groupID) {
    return GroupApi_1.default.callGroupGetApi(groupID).map(formatDetailedGroupResponse);
}
exports.get = get;
function create(groupID, groupName, addAsMember, needsRotation) {
    return GroupCrypto.createGroup(ApiState_1.default.accountPublicKey(), ApiState_1.default.signingKeys().privateKey, addAsMember)
        .flatMap(({ encryptedGroupKey, groupPublicKey, transformKey }) => GroupApi_1.default.callGroupCreateApi(groupID, groupPublicKey, encryptedGroupKey, groupName, transformKey, needsRotation))
        .map((createdGroup) => formatDetailedGroupResponse(createdGroup));
}
exports.create = create;
function update(groupID, groupName) {
    return GroupApi_1.default.callGroupUpdateApi(groupID, groupName).map(formatDetailedGroupResponse);
}
exports.update = update;
function rotateGroupPrivateKey(groupId) {
    return GroupApi_1.default.callGroupGetApi(groupId).flatMap((group) => {
        if (!isGroupAdminResponse(group)) {
            return futurejs_1.default.reject(new SDKError_1.default(new Error("Current user is not authorized to rotate this group's private key as they are not a group administrator."), Constants_1.ErrorCodes.GROUP_ROTATE_PRIVATE_KEY_NOT_ADMIN_FAILURE));
        }
        return UserApi_1.default.callUserKeyListApi(group.adminIds)
            .map((adminKeys) => adminKeys.result.map((user) => ({ id: user.id, masterPublicKey: user.userMasterPublicKey })))
            .flatMap((adminKeys) => GroupCrypto.rotateGroupKey(group.encryptedPrivateKey, adminKeys, ApiState_1.default.devicePrivateKey(), ApiState_1.default.signingKeys()))
            .flatMap(({ encryptedAccessKeys, augmentationFactor }) => GroupApi_1.default.callGroupUpdateKeyApi(groupId, group.currentKeyId, encryptedAccessKeys, augmentationFactor))
            .map(({ needsRotation }) => ({ needsRotation }));
    });
}
exports.rotateGroupPrivateKey = rotateGroupPrivateKey;
function addAdmins(groupID, userList) {
    return futurejs_1.default.gather2(GroupApi_1.default.callGroupGetApi(groupID), UserApi_1.default.callUserKeyListApi(userList)).flatMap(([group, userKeys]) => {
        if (userKeys.result.length === 0) {
            return futurejs_1.default.of(mapOperationToSuccessAndFailureList(userList, [], []));
        }
        if (!isGroupAdminResponse(group)) {
            return futurejs_1.default.reject(new SDKError_1.default(new Error("Current user not allowed to add admins as they are not an admin of the group."), Constants_1.ErrorCodes.GROUP_ADD_ADMINS_NOT_ADMIN_FAILURE));
        }
        const userPublicKeys = userKeys.result.map((user) => ({ id: user.id, masterPublicKey: user.userMasterPublicKey }));
        return GroupCrypto.addAdminsToGroup(group.encryptedPrivateKey, userPublicKeys, ApiState_1.default.devicePrivateKey(), ApiState_1.default.signingKeys().privateKey)
            .flatMap((adminKeyList) => GroupApi_1.default.callAddAdminsApi(groupID, adminKeyList))
            .map(({ failedIds, succeededIds }) => mapOperationToSuccessAndFailureList(userList, succeededIds, failedIds));
    });
}
exports.addAdmins = addAdmins;
function removeAdmins(groupID, userList) {
    return GroupApi_1.default.callRemoveAdminsApi(groupID, userList).map(({ failedIds, succeededIds }) => mapOperationToSuccessAndFailureList(userList, succeededIds, failedIds));
}
exports.removeAdmins = removeAdmins;
function addMembers(groupID, userList) {
    return futurejs_1.default.gather2(GroupApi_1.default.callGroupGetApi(groupID), UserApi_1.default.callUserKeyListApi(userList)).flatMap(([group, userKeys]) => {
        if (userKeys.result.length === 0) {
            return futurejs_1.default.of(mapOperationToSuccessAndFailureList(userList, [], []));
        }
        if (!isGroupAdminResponse(group)) {
            return futurejs_1.default.reject(new SDKError_1.default(new Error("Current user not allowed to add members as they are not an admin of the group."), Constants_1.ErrorCodes.GROUP_ADD_MEMBER_NOT_ADMIN_FAILURE));
        }
        const userPublicKeys = userKeys.result.map((user) => ({ id: user.id, masterPublicKey: user.userMasterPublicKey }));
        return GroupCrypto.addMembersToGroup(group.encryptedPrivateKey, userPublicKeys, ApiState_1.default.devicePrivateKey(), ApiState_1.default.signingKeys().privateKey)
            .flatMap((userKeyList) => GroupApi_1.default.callAddMembersApi(groupID, userKeyList))
            .map(({ failedIds, succeededIds }) => mapOperationToSuccessAndFailureList(userList, succeededIds, failedIds));
    });
}
exports.addMembers = addMembers;
function removeMembers(groupID, userList) {
    return GroupApi_1.default.callRemoveMembersApi(groupID, userList).map(({ failedIds, succeededIds }) => mapOperationToSuccessAndFailureList(userList, succeededIds, failedIds));
}
exports.removeMembers = removeMembers;
function deleteGroup(groupID) {
    return GroupApi_1.default.callGroupDeleteApi(groupID);
}
exports.deleteGroup = deleteGroup;
