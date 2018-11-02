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
