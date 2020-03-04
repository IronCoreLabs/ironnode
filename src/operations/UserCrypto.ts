import Future from "futurejs";
import {ErrorCodes} from "../Constants";
import {decryptUserMasterKey, encryptUserMasterKey, encryptUserMasterKeyWithExistingDerivedKey} from "../crypto/AES";
import {rotateUsersPrivateKeyWithRetry} from "../crypto/Recrypt";
import SDKError from "../lib/SDKError";

/**
 * Rotate the provided user master key. Decrypt the key using the provided password, then rotate it, re-encrypt it, and return the new encrypted key
 * plus the augmentation factor used during rotation.
 */
export function rotateUsersPrivateKey(
    password: string,
    encryptedPrivateKey: Buffer
): Future<SDKError, {newEncryptedPrivateUserKey: Buffer; augmentationFactor: Buffer}> {
    return decryptUserMasterKey(password, encryptedPrivateKey).flatMap(({decryptedPrivateKey, derivedKey, derivedKeySalt}) =>
        rotateUsersPrivateKeyWithRetry(decryptedPrivateKey)
            .errorMap((error) => new SDKError(error, ErrorCodes.USER_PRIVATE_KEY_ROTATION_FAILURE))
            .map(({newPrivateKey, augmentationFactor}) => ({
                newEncryptedPrivateUserKey: encryptUserMasterKeyWithExistingDerivedKey(newPrivateKey, derivedKey, derivedKeySalt),
                augmentationFactor,
            }))
    );
}

/**
 * Decrypt the provided encrypted private user key by deriving a key from their provided current password. The, derive a new key from the provided
 * new password and encrypt their master key with it.
 */
export function reencryptUserMasterPrivateKey(encryptedPrivateUserKey: Buffer, currentPassword: string, newPassword: string): Future<SDKError, Buffer> {
    return decryptUserMasterKey(currentPassword, encryptedPrivateUserKey)
        .flatMap(({decryptedPrivateKey}) => encryptUserMasterKey(newPassword, decryptedPrivateKey))
        .errorMap((e) => new SDKError(e.rawError, ErrorCodes.USER_PASSCODE_CHANGE_FAILURE));
}
