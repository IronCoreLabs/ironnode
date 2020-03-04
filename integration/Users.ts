import * as inquirer from "inquirer";
import {SDK} from "../ironnode";
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
 * Displays a nicely formatted list of documents the user has access to
 */
function getFormattedDeviceList(IronNode: SDK) {
    return inquirer.prompt<{id: number}>({
        type: "list",
        name: "id",
        message: "What's the ID of the device?",
        pageSize: 10,
        choices: () => {
            return IronNode.user.listDevices().then((devices) => {
                const deviceInfo = devices.result.map((device) => ({
                    name: `${device.name} (${device.id})`,
                    value: device.id,
                }));
                return [...deviceInfo, new inquirer.Separator()];
            });
        },
    });
}

/**
 * Display a list of all groups the user is either an admin or a member of
 */
export function publicKeyLookup(IronNode: SDK) {
    return inquirer
        .prompt<{users: string}>([
            {
                name: "users",
                type: "input",
                message: "User IDs to lookup (comma seperate multiple IDs):",
            },
        ])
        .then(({users}) => IronNode.user.getPublicKey(idListToAccessList(users)))
        .then(log);
}

/**
 * Ask for the users escrow password and use it to rotate the users master private key.
 */
export function rotateMasterKey(IronNode: SDK) {
    return inquirer
        .prompt<{escrowPassword: string}>([
            {
                name: "escrowPassword",
                type: "password",
                message: "Enter accounts escrow password:",
            },
        ])
        .then(({escrowPassword}) => IronNode.user.rotateMasterKey(escrowPassword))
        .then(log);
}

/**
 * Get a users devices and display the results
 */
export function deviceList(IronNode: SDK) {
    return IronNode.user.listDevices().then(log);
}

/**
 * Delete a device. Gets the list of the users devices and lets the user pick one to delete
 */
export function deviceDelete(IronNode: SDK) {
    return getFormattedDeviceList(IronNode)
        .then(({id}) => IronNode.user.deleteDevice(id))
        .then(log);
}

/**
 * Ask user for the current and a new password and call into the SDK to change their password.
 */
export function changePassword(IronNode: SDK) {
    return inquirer
        .prompt<{currentPassword: string; newPassword: string}>([
            {
                name: "currentPassword",
                type: "password",
                message: "Enter current escrow password:",
            },
            {
                name: "newPassword",
                type: "password",
                message: "Enter new escrow password:",
            },
        ])
        .then(({currentPassword, newPassword}) => IronNode.user.changePassword(currentPassword, newPassword))
        .then(() => log("Password successfully changed"));
}
