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
        //First convert the API public keys response into a key/value format of userID/public key
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

/**
 * Get a list of all the users devices.
 */
export function getUserDevices() {
    return UserApi.callUserDeviceListApi();
}

/**
 * Delete device keys from the users account given the ID or omit to delete the device used to make the delete request.
 */
export function deleteUserDevice(deviceID?: number) {
    return UserApi.callUserDeviceDeleteApi(deviceID);
}
