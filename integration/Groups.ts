import * as inquirer from "inquirer";
import {SDK, GroupDetailResponse} from "../ironnode";
import {log} from "./Logger";

/**
 * Convert a string of comma separated IDs into an ID list accepted by the SDK
 */
function idListToAccessList(idList: string) {
    if (!idList) {
        return [];
    }
    return idList.split(",").map((id) => id.trim());
}

/**
 * Show list of groups then ask the user for a list of users. Generic method to simplify repeated
 * usages of work for the add/remove admins/members.
 */
function getGroupAndListOfUsers(IronNode: SDK, userPrompt: string) {
    return getFormattedGroupList(IronNode, true).then(({id}) => {
        return inquirer
            .prompt<{userList: string}>({
                name: "userList",
                type: "input",
                message: userPrompt,
            })
            .then(({userList}) => ({id, userList: idListToAccessList(userList)}));
    });
}

/**
 * Displays a nicely formatted list of groups the user has access to, optionally only filtering out ones that
 * the user is an admin of.
 */
function getFormattedGroupList(IronNode: SDK, filterToAdminOnly: boolean = false) {
    return inquirer.prompt<{id: string}>({
        type: "list",
        name: "id",
        message: "What's the ID of the group?",
        pageSize: 10,
        choices: () => {
            return IronNode.group.list().then((groups) => {
                let groupList = groups.result;
                if (filterToAdminOnly) {
                    groupList = groupList.filter((group) => group.isAdmin);
                }

                const docInfo = groupList.map((group) => ({name: `${group.groupName} (${group.groupID})`, value: group.groupID}));
                return [...docInfo, new inquirer.Separator()];
            });
        },
    });
}

/**
 * Display a list of all groups the user is either an admin or a member of
 */
export function list(IronNode: SDK) {
    return IronNode.group.list().then(log);
}

/**
 * Get details about a document. Shows the list
 */
export function get(IronNode: SDK) {
    return getFormattedGroupList(IronNode)
        .then(({id}) => IronNode.group.get(id))
        .then(log);
}

/**
 * Create a new group
 */
export function create(IronNode: SDK) {
    return inquirer
        .prompt<{id: string; name: string; addAsMember: boolean}>([
            {
                name: "id",
                type: "input",
                message: "Group ID (optional):",
            },
            {
                name: "name",
                type: "input",
                message: "Group Name (optional):",
            },
            {
                name: "addAsMember",
                type: "confirm",
                message: "Add yourself as a member? ",
            },
        ])
        .then(({id, name, addAsMember}) => {
            const options = {
                groupID: id || undefined,
                groupName: name || undefined,
                addAsMember,
            };
            return IronNode.group.create(options);
        })
        .then(log);
}

/**
 * Update the name of an existing group to a new name or clear out the value.
 */
export function update(IronNode: SDK) {
    return getFormattedGroupList(IronNode, true)
        .then(({id}) => {
            return inquirer
                .prompt<{newName: string | null}>({
                    name: "newName",
                    type: "input",
                    message: "New Name (leave blank to clear name field):",
                })
                .then(({newName}) => IronNode.group.update(id, {groupName: newName || null}));
        })
        .then(log);
}

/**
 * Add admins to a group that the user is an admin of.
 */
export function addAdmins(IronNode: SDK) {
    return getGroupAndListOfUsers(IronNode, "Comma separated list of users to add as admins: ")
        .then(({id, userList}) => IronNode.group.addAdmins(id, userList))
        .then(log);
}

/**
 * Remove admins from a group that the user is an admin of.
 */
export function removeAdmins(IronNode: SDK) {
    return getFormattedGroupList(IronNode, true)
        .then(({id}) => IronNode.group.get(id))
        .then((groupDetail) => {
            return inquirer
                .prompt<{userList: string[]}>({
                    name: "userList",
                    type: "checkbox",
                    message: "Which users do you want to remove as admins?",
                    choices: (groupDetail as GroupDetailResponse).groupAdmins,
                })
                .then(({userList}) => IronNode.group.removeAdmins(groupDetail.groupID, userList));
        })
        .then(log);
}

/**
 * Add members to a group that the user is an admin of.
 */
export function addMembers(IronNode: SDK) {
    return getGroupAndListOfUsers(IronNode, "Comma separated list of users to add as members: ")
        .then(({id, userList}) => IronNode.group.addMembers(id, userList))
        .then(log);
}

/**
 * Remove members from a group that the user is an admin of.
 */
export function removeMembers(IronNode: SDK) {
    return getFormattedGroupList(IronNode, true)
        .then(({id}) => IronNode.group.get(id))
        .then((groupDetail) => {
            return inquirer
                .prompt<{userList: string[]}>({
                    name: "userList",
                    type: "checkbox",
                    message: "Which users do you want to remove as members?",
                    choices: (groupDetail as GroupDetailResponse).groupMembers,
                })
                .then(({userList}) => IronNode.group.removeMembers(groupDetail.groupID, userList));
        })
        .then(log);
}
