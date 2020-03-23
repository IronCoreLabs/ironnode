"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const UserOperations = require("../operations/UserOperations");
function getPublicKey(users) {
    if (!users || !users.length) {
        throw new Error("You must provide a user ID or list of users IDs to perform this operation.");
    }
    return UserOperations.getUserPublicKeys(Array.isArray(users) ? users : [users]).toPromise();
}
exports.getPublicKey = getPublicKey;
function listDevices() {
    return UserOperations.getUserDevices().toPromise();
}
exports.listDevices = listDevices;
function deleteDevice(deviceID) {
    if (deviceID && typeof deviceID !== "number") {
        throw new Error(`Invalid device ID provided. Expected a number greater than zero but got ${deviceID}`);
    }
    return UserOperations.deleteUserDevice(deviceID).toPromise();
}
exports.deleteDevice = deleteDevice;
function rotateMasterKey(password) {
    return UserOperations.rotateMasterKey(password).toPromise();
}
exports.rotateMasterKey = rotateMasterKey;
function changePassword(currentPassword, newPassword) {
    return UserOperations.changeUsersPassword(currentPassword, newPassword).toPromise();
}
exports.changePassword = changePassword;
