"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Utils = require("../lib/Utils");
const GroupOperations = require("../operations/GroupOperations");
function list() {
    return GroupOperations.list().toPromise();
}
exports.list = list;
function get(groupID) {
    Utils.validateID(groupID);
    return GroupOperations.get(groupID).toPromise();
}
exports.get = get;
function create(options = { groupName: "", addAsMember: true, needsRotation: false }) {
    if (options.groupID) {
        Utils.validateID(options.groupID);
    }
    return GroupOperations.create(options.groupID || "", options.groupName || "", options.addAsMember !== false, options.needsRotation === true).toPromise();
}
exports.create = create;
function update(groupID, options) {
    Utils.validateID(groupID);
    if (options.groupName === null || (typeof options.groupName === "string" && options.groupName.length)) {
        return GroupOperations.update(groupID, options.groupName).toPromise();
    }
    throw new Error("Group update must provide a new name which is either a non-zero length string or null.");
}
exports.update = update;
function rotatePrivateKey(groupId) {
    Utils.validateID(groupId);
    return GroupOperations.rotateGroupPrivateKey(groupId).toPromise();
}
exports.rotatePrivateKey = rotatePrivateKey;
function addAdmins(groupID, userList) {
    Utils.validateID(groupID);
    Utils.validateIDList(userList);
    return GroupOperations.addAdmins(groupID, Utils.dedupeArray(userList, true)).toPromise();
}
exports.addAdmins = addAdmins;
function removeAdmins(groupID, userList) {
    Utils.validateID(groupID);
    Utils.validateIDList(userList);
    return GroupOperations.removeAdmins(groupID, Utils.dedupeArray(userList, true)).toPromise();
}
exports.removeAdmins = removeAdmins;
function addMembers(groupID, userList) {
    Utils.validateID(groupID);
    Utils.validateIDList(userList);
    return GroupOperations.addMembers(groupID, Utils.dedupeArray(userList, true)).toPromise();
}
exports.addMembers = addMembers;
function removeMembers(groupID, userList) {
    Utils.validateID(groupID);
    Utils.validateIDList(userList);
    return GroupOperations.removeMembers(groupID, Utils.dedupeArray(userList, true)).toPromise();
}
exports.removeMembers = removeMembers;
function deleteGroup(groupID) {
    Utils.validateID(groupID);
    return GroupOperations.deleteGroup(groupID).toPromise();
}
exports.deleteGroup = deleteGroup;
