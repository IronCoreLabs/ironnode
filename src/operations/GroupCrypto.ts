import Future from "futurejs";
import {EncryptedAccessKey, PrivateKey, PublicKey, SigningKeyPair, TransformedEncryptedMessage, UserOrGroupPublicKey} from "../commonTypes";
import {ErrorCodes} from "../Constants";
import * as Recrypt from "../crypto/Recrypt";
import SDKError from "../lib/SDKError";

/**
 * Create the keys for a new group. Generates a new keypair for the group and encrypts the value used to generate the
 * group private key to the provided user public key
 */
export function createGroup(userPublicKey: PublicKey<Buffer>, privateSigningKey: PrivateKey<Buffer>, addAsMember: boolean) {
    return Recrypt.generateGroupKeyPair()
        .flatMap(({publicKey, plaintext, privateKey}) => {
            return Future.gather2(
                Recrypt.encryptPlaintext(plaintext, userPublicKey, privateSigningKey),
                addAsMember ? Recrypt.generateTransformKey(privateKey, userPublicKey, privateSigningKey) : Future.of(undefined)
            ).map(([encryptedGroupKey, transformKey]) => ({
                encryptedGroupKey,
                groupPublicKey: publicKey,
                transformKey,
            }));
        })
        .errorMap((error) => new SDKError(error, ErrorCodes.GROUP_KEY_GENERATION_FAILURE));
}

/**
 * Decrypt the provided encrypted group key, then calculate a new private key using key rotation. Once we have a new group private key
 * re-encrypt it to each of the provided admins that are inthe group.
 */
export function rotateGroupKey(
    encryptedGroupKey: TransformedEncryptedMessage,
    adminList: UserOrGroupPublicKey[],
    userPrivateKey: PrivateKey<Buffer>,
    signingKeys: SigningKeyPair
) {
    return Recrypt.decryptPlaintext(encryptedGroupKey, userPrivateKey)
        .flatMap(([, groupKey]) => Recrypt.rotateGroupPrivateKeyWithRetry(groupKey))
        .flatMap(({plaintext, augmentationFactor}) =>
            Recrypt.encryptPlaintextToList(plaintext, adminList, signingKeys.privateKey).map((encryptedAccessKeys) => ({
                encryptedAccessKeys,
                augmentationFactor,
            }))
        )
        .errorMap((error) => new SDKError(error, ErrorCodes.GROUP_PRIVATE_KEY_ROTATION_FAILURE));
}

/**
 * Generate encrypted access keys to the groups private key for the provided list of users in order to make them admins of the group.
 */
export function addAdminsToGroup(
    encryptedGroupPrivateKey: TransformedEncryptedMessage,
    userKeyList: UserOrGroupPublicKey[],
    adminPrivateKey: PrivateKey<Buffer>,
    privateSigningKey: PrivateKey<Buffer>
): Future<SDKError, EncryptedAccessKey[]> {
    return Recrypt.decryptPlaintext(encryptedGroupPrivateKey, adminPrivateKey)
        .flatMap(([plaintext]) => Recrypt.encryptPlaintextToList(plaintext, userKeyList, privateSigningKey))
        .errorMap((error) => new SDKError(error, ErrorCodes.GROUP_KEY_DECRYPTION_FAILURE));
}

/**
 * Decrypt the provided group private key and use it to generate transform keys to each public user key provided.
 */
export function addMembersToGroup(
    groupPrivateKey: TransformedEncryptedMessage,
    userKeyList: UserOrGroupPublicKey[],
    adminPrivateKey: PrivateKey<Buffer>,
    privateSigningKey: PrivateKey<Buffer>
) {
    return Recrypt.decryptPlaintext(groupPrivateKey, adminPrivateKey)
        .flatMap(([_, key]) => Recrypt.generateTransformKeyToList(key, userKeyList, privateSigningKey))
        .errorMap((error) => new SDKError(error, ErrorCodes.GROUP_MEMBER_KEY_ENCRYPTION_FAILURE));
}
