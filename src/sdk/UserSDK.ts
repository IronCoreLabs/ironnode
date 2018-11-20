import * as UserOperations from "../operations/UserOperations";

/**
 * Get a list of user public keys given a single user or a list of user IDs.
 */
export function getPublicKey(users: string | string[]) {
    if (!users || !users.length) {
        throw new Error("You must provide a user ID or list of users IDs to perform this operation.");
    }
    return UserOperations.getUserPublicKeys(Array.isArray(users) ? users : [users]).toPromise();
}

/**
 * Get a list of the current users devices. Returns information about the device ID, name, and created/updated times.
 */
export function listDevices() {
    return UserOperations.getUserDevices().toPromise();
}

/**
 * Delete a device given its ID. Removes device keys and makes them unusable for future API requests.
 * @param {number} deviceID ID of device to delete
 */
export function deleteDevice(deviceID: number) {
    if (typeof deviceID !== "number" || !deviceID) {
        throw new Error(`Invalid device ID provided. Expected a number greater than zero but got ${deviceID}`);
    }
    return UserOperations.deleteUserDevice(deviceID).toPromise();
}
