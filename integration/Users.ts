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
        .then(({users}) => {
            return IronNode.user.getPublicKey(idListToAccessList(users));
        })
        .then(log);
}
