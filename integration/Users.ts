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
