import Future from "futurejs";
import {GroupCreateOptions, GroupDetailResponse, GroupListResponse, GroupMetaResponse, GroupUserEditResponse} from "../../ironnode";
import GroupApi from "../api/GroupApi";
import UserApi from "../api/UserApi";
import {GroupApiAdminResponse, GroupApiBasicResponse, GroupApiMemberOrAdminResponse} from "../commonTypes";
import {ErrorCodes, GroupPermissions} from "../Constants";
import ApiState from "../lib/ApiState";
import SDKError from "../lib/SDKError";
import * as GroupCrypto from "./GroupCrypto";

export interface InteralGroupCreateOptions extends GroupCreateOptions {
    groupID: string;
    addAsMember: boolean;
    groupName: string;
}

/**
 * Type guard to determine if provided group contains the full response of admin and member IDs.
 */
const isFullGroupResponse = (group: GroupApiBasicResponse | GroupApiMemberOrAdminResponse): group is GroupApiMemberOrAdminResponse =>
    Array.isArray((group as GroupApiMemberOrAdminResponse).adminIds);

/**
 * Type guard to determine if provided group represents the group that the user is an admin of.
 */
const isGroupAdminResponse = (group: GroupApiBasicResponse | GroupApiMemberOrAdminResponse | GroupApiAdminResponse): group is GroupApiAdminResponse =>
    (group as GroupApiAdminResponse).encryptedPrivateKey !== undefined;

/**
 * Map the results of a group operation which involes multiple IDs into the expected success/failure lists. This method takes the original list of user IDs that were
 * requested by the user, the list of successes from the server, and the list of failures and provides a list of success/failure entities for each item. The original
 * request list is passed in to make sure that we have a result (good or bad) for every user that was requested. For example, if they asked to add 3 users and 1 was
 * successful, one failed, but the last couldn't be found, this method ensures the result includes a failure for the user who could not be found.
 */
function mapOperationToSuccessAndFailureList(
    requestedList: string[],
    succeededIds: Array<{userId: string}>,
    failedIDs: Array<{userId: string; errorMessage: string}>
): GroupUserEditResponse {
    const missingUserList = requestedList
        .filter((id) => {
            return !succeededIds.some(({userId}) => id === userId) && !failedIDs.some(({userId}) => id === userId);
        })
        .map((id) => ({id, error: "ID did not exist in the system."}));

    return {
        succeeded: succeededIds.map(({userId}) => userId),
        failed: failedIDs.map(({userId, errorMessage}) => ({id: userId, error: errorMessage})).concat(missingUserList),
    };
}

/**
 * Convert the internal detailed group representation into the external group representation that we expose out to clients.
 */
function formatDetailedGroupResponse(
    group: GroupApiBasicResponse | GroupApiMemberOrAdminResponse | GroupApiAdminResponse
): GroupMetaResponse | GroupDetailResponse {
    const groupResponse: GroupMetaResponse | GroupDetailResponse = {
        groupID: group.id,
        groupName: group.name,
        isAdmin: group.permissions.indexOf(GroupPermissions.ADMIN) !== -1,
        isMember: group.permissions.indexOf(GroupPermissions.MEMBER) !== -1,
        created: group.created,
        updated: group.updated,
    };

    if (isFullGroupResponse(group)) {
        (groupResponse as GroupDetailResponse).groupAdmins = group.adminIds;
        (groupResponse as GroupDetailResponse).groupMembers = group.memberIds;
    }
    if (isGroupAdminResponse(group)) {
        (groupResponse as GroupDetailResponse).needsRotation = group.needsRotation;
    }
    return groupResponse;
}

/**
 * Get a list of all groups that the current user is either a member or admin of.
 */
export function list(): Future<SDKError, GroupListResponse> {
    return GroupApi.callGroupListApi().map((groups) => ({
        result: groups.result.map(formatDetailedGroupResponse),
    }));
}

/**
 * Get a specific group based on ID and return the meta info for the group
 * @param {string} groupID ID of group to retrieve
 */
export function get(groupID: string) {
    return GroupApi.callGroupGetApi(groupID).map(formatDetailedGroupResponse);
}

/**
 * Create a new group with the provided ID and options
 */
export function create(groupID: string, groupName: string, addAsMember: boolean, needsRotation: boolean) {
    return GroupCrypto.createGroup(ApiState.accountPublicKey(), ApiState.signingKeys().privateKey, addAsMember)
        .flatMap(({encryptedGroupKey, groupPublicKey, transformKey}) =>
            GroupApi.callGroupCreateApi(groupID, groupPublicKey, encryptedGroupKey, groupName, transformKey, needsRotation)
        )
        .map((createdGroup) => formatDetailedGroupResponse(createdGroup) as GroupDetailResponse);
}

/**
 * Update group information. Currently only supports updating a group's name.
 * @param {string}      groupID   ID of the group to update.
 * @param {string|null} groupName New name for the group or null to clear a groups name.
 */
export function update(groupID: string, groupName: string | null) {
    return GroupApi.callGroupUpdateApi(groupID, groupName).map(formatDetailedGroupResponse);
}

/**
 * Rotate the provided groups private key. Get the group to verify that the calling user is an admin of the group, then rotate the key
 * and save the new encrypted key back to the API.
 */
export function rotateGroupPrivateKey(groupId: string) {
    return GroupApi.callGroupGetApi(groupId).flatMap((group) => {
        if (!isGroupAdminResponse(group)) {
            return Future.reject(
                new SDKError(
                    new Error("Current user is not authorized to rotate this group's private key as they are not a group administrator."),
                    ErrorCodes.GROUP_ROTATE_PRIVATE_KEY_NOT_ADMIN_FAILURE
                )
            );
        }
        return UserApi.callUserKeyListApi(group.adminIds)
            .map((adminKeys) => adminKeys.result.map((user) => ({id: user.id, masterPublicKey: user.userMasterPublicKey})))
            .flatMap((adminKeys) => GroupCrypto.rotateGroupKey(group.encryptedPrivateKey, adminKeys, ApiState.devicePrivateKey(), ApiState.signingKeys()))
            .flatMap(({encryptedAccessKeys, augmentationFactor}) =>
                GroupApi.callGroupUpdateKeyApi(groupId, group.currentKeyId, encryptedAccessKeys, augmentationFactor)
            )
            .map(({needsRotation}) => ({needsRotation}));
    });
}

/**
 * Add the provided list of user IDs as admins to the group ID provided. Ensures that the calling user is an admin before allowing additional admins
 * to be added.
 * @param {string}   groupID  ID of the group to add admins to
 * @param {string[]} userList List of user IDs to add as admins
 */
export function addAdmins(groupID: string, userList: string[]) {
    return Future.gather2(GroupApi.callGroupGetApi(groupID), UserApi.callUserKeyListApi(userList)).flatMap<GroupUserEditResponse>(([group, userKeys]) => {
        //If none of the users they asked to add exist, return a success with each user in the list of failures
        if (userKeys.result.length === 0) {
            return Future.of(mapOperationToSuccessAndFailureList(userList, [], []));
        }
        if (!isGroupAdminResponse(group)) {
            return Future.reject(
                new SDKError(
                    new Error("Current user not allowed to add admins as they are not an admin of the group."),
                    ErrorCodes.GROUP_ADD_ADMINS_NOT_ADMIN_FAILURE
                )
            );
        }
        const userPublicKeys = userKeys.result.map((user) => ({id: user.id, masterPublicKey: user.userMasterPublicKey}));
        return GroupCrypto.addAdminsToGroup(group.encryptedPrivateKey, userPublicKeys, ApiState.devicePrivateKey(), ApiState.signingKeys().privateKey)
            .flatMap((adminKeyList) => GroupApi.callAddAdminsApi(groupID, adminKeyList))
            .map(({failedIds, succeededIds}) => mapOperationToSuccessAndFailureList(userList, succeededIds, failedIds));
    });
}

/**
 * Remove the provided list of admin users as admins of the provided group.
 * @param {string}   groupID  Group ID from which to remove admins
 * @param {string[]} userList List of user IDs to remove as admins from the group
 */
export function removeAdmins(groupID: string, userList: string[]) {
    return GroupApi.callRemoveAdminsApi(groupID, userList).map(({failedIds, succeededIds}) =>
        mapOperationToSuccessAndFailureList(userList, succeededIds, failedIds)
    );
}

/**
 * Add list of members to the group. Gets the group private key and list of users public keys and generates a transform key from the
 * group private key to each member public key. Will fail if the requesting user is not an admin for the group
 * @param {string}   groupID  ID of group to add members to
 * @param {string[]} userList List of user IDs to add to group
 */
export function addMembers(groupID: string, userList: string[]) {
    return Future.gather2(GroupApi.callGroupGetApi(groupID), UserApi.callUserKeyListApi(userList)).flatMap<GroupUserEditResponse>(([group, userKeys]) => {
        //If none of the users they asked to add exist, return a success with each user in the list of failures
        if (userKeys.result.length === 0) {
            return Future.of(mapOperationToSuccessAndFailureList(userList, [], []));
        }
        if (!isGroupAdminResponse(group)) {
            return Future.reject(
                new SDKError(
                    new Error("Current user not allowed to add members as they are not an admin of the group."),
                    ErrorCodes.GROUP_ADD_MEMBER_NOT_ADMIN_FAILURE
                )
            );
        }
        const userPublicKeys = userKeys.result.map((user) => ({id: user.id, masterPublicKey: user.userMasterPublicKey}));
        return GroupCrypto.addMembersToGroup(group.encryptedPrivateKey, userPublicKeys, ApiState.devicePrivateKey(), ApiState.signingKeys().privateKey)
            .flatMap((userKeyList) => GroupApi.callAddMembersApi(groupID, userKeyList))
            .map(({failedIds, succeededIds}) => mapOperationToSuccessAndFailureList(userList, succeededIds, failedIds));
    });
}

/**
 * Remove list of users from a group. All we have to do is pass the list of user IDs to the API and then map the success/failure IDs appropriately.
 * @param {string}   groupID  ID of group to remove members from
 * @param {string[]} userList List of members to remove
 */
export function removeMembers(groupID: string, userList: string[]) {
    return GroupApi.callRemoveMembersApi(groupID, userList).map(({failedIds, succeededIds}) =>
        mapOperationToSuccessAndFailureList(userList, succeededIds, failedIds)
    );
}

/**
 * Delete a group given its ID.
 * @param {string} groupID ID of the group to delete.
 */
export function deleteGroup(groupID: string) {
    return GroupApi.callGroupDeleteApi(groupID);
}
