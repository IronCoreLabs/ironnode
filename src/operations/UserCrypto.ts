import Future from "futurejs";
import {ErrorCodes} from "../Constants";
import {decryptUserMasterKey, encryptUserMasterKeyWithExistingDerivedKey} from "../crypto/AES";
import {rotateUsersPrivateKeyWithRetry} from "../crypto/Recrypt";
import SDKError from "../lib/SDKError";

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
