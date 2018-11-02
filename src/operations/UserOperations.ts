import Future from "futurejs";
import {PublicKey} from "../commonTypes";
import {UserPublicKeyGetResponse} from "../../ironnode";
import SDKError from "../lib/SDKError";
import UserApi from "../api/UserApi";

/**
 * Get a list of all groups that the current user is either a member or admin of.
 */
export function getUserPublicKeys(userList: string[]): Future<SDKError, UserPublicKeyGetResponse> {
    return UserApi.callUserKeyListApi(userList).map((keyList) => {
        //First conver the API returned public keys into a key/value format of userID/public key
        const publicKeysById = keyList.result.reduce(
            (list, userKey) => {
                list[userKey.id] = userKey.userMasterPublicKey;
                return list;
            },
            {} as {[key: string]: PublicKey<string>}
        );
        //Then iterate through the requested list of IDs to fill in the ones that didn't exist
        return userList.reduce((fullListResponse: {[key: string]: PublicKey<string> | null}, requestedUserID) => {
            if (!fullListResponse[requestedUserID]) {
                fullListResponse[requestedUserID] = null;
            }
            return fullListResponse;
        }, publicKeysById);
    });
}
