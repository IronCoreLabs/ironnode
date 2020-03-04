import Future from "futurejs";
import {UserPublicKeyGetResponse} from "../../ironnode";
import UserApi from "../api/UserApi";
import {PublicKey} from "../commonTypes";
import ApiState from "../lib/ApiState";
import SDKError from "../lib/SDKError";
import * as UserCrypto from "./UserCrypto";

/**
 * Get a list of all groups that the current user is either a member or admin of.
 */
export function getUserPublicKeys(userList: string[]): Future<SDKError, UserPublicKeyGetResponse> {
    return UserApi.callUserKeyListApi(userList).map((keyList) => {
        //First convert the API public keys response into a key/value format of userID/public key
        const publicKeysById = keyList.result.reduce((list, userKey) => {
            list[userKey.id] = userKey.userMasterPublicKey;
            return list;
        }, {} as {[key: string]: PublicKey<string>});
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

/**
 * Rotate the current users master key. Takes their escrow password, decrypts their master private key, rotates the key, then re-encrypts the users
 * key and saves it to ironcore-id.
 */
export function rotateMasterKey(password: string): Future<SDKError, {needsRotation: boolean}> {
    return UserCrypto.rotateUsersPrivateKey(password, ApiState.accountEncryptedPrivateKey()).flatMap(({newEncryptedPrivateUserKey, augmentationFactor}) =>
        UserApi.callUserKeyUpdateApi(newEncryptedPrivateUserKey, augmentationFactor).map(({needsRotation}) => {
            //Since the users private key is now different, store it off in case the user performs any operations that need itwithin this existing session.
            ApiState.setEncryptedPrivateUserKey(newEncryptedPrivateUserKey);
            return {needsRotation};
        })
    );
}

/**
 * Decrypt and reencrypt the users master private key using the provided passwords. Then make a call to the API to store their newly encrypted master private
 * key and save it to state for future session use.
 */
export function changeUsersPassword(currentPassword: string, newPassword: string): Future<SDKError, void> {
    return UserCrypto.reencryptUserMasterPrivateKey(ApiState.accountEncryptedPrivateKey(), currentPassword, newPassword).flatMap((newEncryptedPrivateKey) =>
        UserApi.callUserUpdatePrivateKey(newEncryptedPrivateKey).map(() => {
            ApiState.setEncryptedPrivateUserKey(newEncryptedPrivateKey);
            return undefined;
        })
    );
}
