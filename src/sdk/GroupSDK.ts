import * as GroupOperations from "../operations/GroupOperations";
import * as Utils from "../lib/Utils";
import {GroupCreateOptions} from "../../ironnode";

/**
 * List all groups that the current user is either an admin or member of.
 */
export function list() {
    return GroupOperations.list().toPromise();
}

/**
 * Get details about a specific group given it's ID.
 * @param {string} groupID ID of group to retrieve
 */
export function get(groupID: string) {
    Utils.validateID(groupID);
    return GroupOperations.get(groupID).toPromise();
}

/**
 * Create a new group. Takes an options object which allow for specifying an optional, unencrypted ID and name for the group.
 * @param {GroupCreateOptions} options Group creation options
 */
export function create(options: GroupCreateOptions = {groupName: "", addAsMember: true}) {
    if (options.groupID) {
        Utils.validateIDWithSeperators(options.groupID);
    }
    return GroupOperations.create(options.groupID || "", options.groupName || "", options.addAsMember !== false).toPromise();
}

/**
 * Add list of users as admins to an existing group.
 * @param {string}   groupID  ID of gropu to add admins to.
 * @param {string[]} userList List of user IDs to add as admins to the group
 */
export function addAdmins(groupID: string, userList: string[]) {
    Utils.validateID(groupID);
    Utils.validateIDList(userList);
    return GroupOperations.addAdmins(groupID, Utils.dedupeArray(userList, true)).toPromise();
}

/**
 * Remove list of users as admins from the provided Group ID. This operation can only be performed by an admin of the group. Also note
 * that the group creator cannot be removed as an admin from the group.
 * @param {string}   groupID  ID of the group to remove admins from
 * @param {string[]} userList List of users to remove as admins from the group
 */
export function removeAdmins(groupID: string, userList: string[]) {
    Utils.validateID(groupID);
    Utils.validateIDList(userList);
    return GroupOperations.removeAdmins(groupID, Utils.dedupeArray(userList, true)).toPromise();
}

/**
 * Add list of users as members to an existing group. This operation can only be performed by an admin of the group.
 * @param {string}   groupID  ID of the group to add members to.
 * @param {string[]} userList List of user IDs to add as members to the group
 */
export function addMembers(groupID: string, userList: string[]) {
    Utils.validateID(groupID);
    Utils.validateIDList(userList);
    return GroupOperations.addMembers(groupID, Utils.dedupeArray(userList, true)).toPromise();
}

/**
 * Remove list of users as members from an existing group. This operation can only be performed by an admin of the group.
 * @param {string}   groupID  ID of the group to remove members from.
 * @param {string[]} userList List of user IDs to remove as members from the group.
 */
export function removeMembers(groupID: string, userList: string[]) {
    Utils.validateID(groupID);
    Utils.validateIDList(userList);
    return GroupOperations.removeMembers(groupID, Utils.dedupeArray(userList, true)).toPromise();
}
