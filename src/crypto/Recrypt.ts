import * as Recrypt from "@ironcorelabs/recrypt-node-binding";
import Future from "futurejs";
import {Codec} from "../lib/Utils";
import {
    RecryptEncryptedMessage,
    TransformedEncryptedMessage,
    PrivateKey,
    PublicKey,
    KeyPair,
    UserOrGroupPublicKey,
    EncryptedAccessKey,
    SigningPublicKey,
} from "../commonTypes";

/**
 * Recrypt API Instance
 */
const RecryptApi = new Recrypt.Api256();

export interface TransformKeyGrant {
    transformKey: Recrypt.TransformKey;
    publicKey: PublicKey<string>;
    id: string;
}
type Plaintext = Buffer;

/**
 * Convert the components of an encrypted symmetric key into base64 strings for submission to the API
 * @param {EncryptedValue} encryptedValue Encrypted value to transform
 */
function encryptedValueToBase64(encryptedValue: Recrypt.EncryptedValue): RecryptEncryptedMessage {
    return {
        encryptedMessage: Codec.Buffer.toBase64(encryptedValue.encryptedMessage),
        ephemeralPublicKey: Codec.PublicKey.toBase64(encryptedValue.ephemeralPublicKey),
        authHash: Codec.Buffer.toBase64(encryptedValue.authHash),
        publicSigningKey: Codec.Buffer.toBase64(encryptedValue.publicSigningKey),
        signature: Codec.Buffer.toBase64(encryptedValue.signature),
    };
}

/**
 * Convert the parts of an encrypted plaintext string representation into a EncryptedValue that is expected
 * by the Recrypt library.
 * @param {TransformedEncryptedMessage} encryptedKey Symmetric key object to convert from string to bytes
 */
function transformedPlaintextToEncryptedValue(encryptedKey: TransformedEncryptedMessage): Recrypt.EncryptedValue {
    return {
        encryptedMessage: Codec.Buffer.fromBase64(encryptedKey.encryptedMessage),
        ephemeralPublicKey: Codec.PublicKey.fromBase64(encryptedKey.ephemeralPublicKey),
        publicSigningKey: Codec.Buffer.fromBase64(encryptedKey.publicSigningKey),
        authHash: Codec.Buffer.fromBase64(encryptedKey.authHash),
        signature: Codec.Buffer.fromBase64(encryptedKey.signature),
        transformBlocks: encryptedKey.transformBlocks.map((transformBlock) => ({
            encryptedTempKey: Codec.Buffer.fromBase64(transformBlock.encryptedTempKey),
            publicKey: Codec.PublicKey.fromBase64(transformBlock.publicKey),
            randomTransformEncryptedTempKey: Codec.Buffer.fromBase64(transformBlock.randomTransformEncryptedTempKey),
            randomTransformPublicKey: Codec.PublicKey.fromBase64(transformBlock.randomTransformPublicKey),
        })),
    };
}

/**
 * Generate a new Recrypt key pair and do some post processing to convert structure.
 */
export function generateKeyPair(): Future<Error, KeyPair> {
    return Future.tryF(() => RecryptApi.generateKeyPair());
}

/**
 * Generate a three-tuple of a new group private/public key and plaintext
 */
export function generateGroupKeyPair() {
    return Future.tryF(() => {
        const plaintext = RecryptApi.generatePlaintext();
        const privateKey = RecryptApi.hash256(plaintext);
        return {
            privateKey,
            plaintext,
            publicKey: RecryptApi.computePublicKey(privateKey),
        };
    });
}

/**
 * Generate a new transform key from the provided private key to the provided public key
 * @param {PrivateKey<Buffer>} fromPrivateKey Private key to generate transform key from
 * @param {PublicKey<Buffer>}  toPublicKey    Public key to generate a transform to
 * @param {SigningKeyPair}     signingKeys    Current users signing keys used to sign transform key
 */
export function generateTransformKey(fromPrivateKey: PrivateKey<Buffer>, toPublicKey: PublicKey<Buffer>, privateSigningKey: PrivateKey<Buffer>) {
    return Future.tryF(() => RecryptApi.generateTransformKey(fromPrivateKey, toPublicKey, privateSigningKey));
}

/**
 * Generate a new transform key from the provided private key to each of the provided public keys
 * @param {Buffer}                 fromPrivateKey Private key to generate transform key from
 * @param {UserOrGroupPublicKey[]} publicKeyList  List of public keys to generate a transform to
 * @param {SigningKeyPair}         signingKeys    Current users signing k eys used to sign transform keys
 */
export function generateTransformKeyToList(
    fromPrivateKey: Buffer,
    publicKeyList: UserOrGroupPublicKey[],
    privateSigningKey: PrivateKey<Buffer>
): Future<Error, TransformKeyGrant[]> {
    if (!publicKeyList.length) {
        return Future.of<TransformKeyGrant[]>([]);
    }
    const transformKeyFutures = publicKeyList.map(({masterPublicKey, id}) => {
        return generateTransformKey(fromPrivateKey, Codec.PublicKey.fromBase64(masterPublicKey), privateSigningKey).map((transformKey) => ({
            transformKey,
            publicKey: masterPublicKey,
            id,
        }));
    });
    return Future.all(transformKeyFutures);
}

/**
 * Generate a new document Recrypt symmetric key
 */
export function generateDocumentKey() {
    return Future.tryF(() => {
        const plaintext = RecryptApi.generatePlaintext();
        return [plaintext, RecryptApi.hash256(plaintext)];
    });
}

/**
 * Generate a new ed25519 signing key pair.
 */
export function generateEd25519KeyPair() {
    return RecryptApi.generateEd25519KeyPair();
}

/**
 * Sign the provided message with the provided ed25519 signing private key
 * @param {PrivateKey<Buffer>} privateKey ed25519 signing private key
 * @param {Buffer}             message    Message to sign
 */
export function ed25519Sign(privateKey: PrivateKey<Buffer>, message: Buffer) {
    return RecryptApi.ed25519Sign(privateKey, message);
}

/**
 * Verify the provided signature using the provided public key and message that was originally signed.
 * @param {SigningPublicKey<Buffer>} publicKey ed25519 public key that is the counterpart to the provided private key used to generate the provided signature
 * @param {Buffer}                   message   Original message that was signed over
 * @param {Buffer}                   signature Signature message to verify
 */
export function ed25519Verify(publicKey: SigningPublicKey<Buffer>, message: Buffer, signature: Buffer) {
    return RecryptApi.ed25519Verify(publicKey, message, signature);
}

/**
 * Compute the ed25519 public key given the associated private key.
 * @param {PrivateKey<Buffer>} privateKey Private key to compute public key from.
 */
export function computeEd25519PublicKey(privateKey: PrivateKey<Buffer>) {
    return RecryptApi.computeEd25519PublicKey(privateKey);
}

/**
 * Given a Recrypt private key, derive the public key
 */
export function derivePublicKey(privateKey: PrivateKey<Buffer>) {
    return Future.tryF(() => RecryptApi.computePublicKey(privateKey));
}

/**
 * Encrypt the provided plaintext to the public key provided
 * @param {Plaintext}         plaintext     Recrypt generated document symmetric key plaintext
 * @param {PublicKey<Buffer>} userPublicKey Public key to encrypt to
 * @param {SigningKeyPair}    signingKeys   Current users signing keys used to sign transform key
 */
export function encryptPlaintext(
    plaintext: Plaintext,
    userPublicKey: PublicKey<Buffer>,
    privateSigningKey: PrivateKey<Buffer>
): Future<Error, RecryptEncryptedMessage> {
    return Future.tryF(() => encryptedValueToBase64(RecryptApi.encrypt(plaintext, userPublicKey, privateSigningKey)));
}

/**
 * Encrypt the provided plaintext to each of the public keys provided in the list
 * @param {Plaintext}               plaintext   Recrypt generated document symmetric key to encrypt
 * @param {UserPublicKeyResponse[]} keyList     List of public keys (either user or group) who we will encrypt the document to using their public key
 * @param {SigningKeyPair}          signingKeys Current users signing keys used to sign transform key
 */
export function encryptPlaintextToList(
    plaintext: Plaintext,
    keyList: UserOrGroupPublicKey[],
    privateSigningKey: PrivateKey<Buffer>
): Future<Error, EncryptedAccessKey[]> {
    if (!keyList.length) {
        return Future.of<EncryptedAccessKey[]>([]);
    }
    const encryptKeyFutures = keyList.map(({masterPublicKey, id}) => {
        return encryptPlaintext(plaintext, Codec.PublicKey.fromBase64(masterPublicKey), privateSigningKey).map((encryptedPlaintext) => ({
            encryptedPlaintext,
            publicKey: masterPublicKey,
            id,
        }));
    });
    return Future.all(encryptKeyFutures);
}

/**
 * Decrypt a Recrypt encrypted plaintext using the provided private key
 * @param {TransformedEncryptedMessage} encryptedPlaintext Encrypted plaintext key to decrypt
 * @param {PrivateKey<Buffer>}          userPrivateKey     Users private key to decrypt
 */
export function decryptPlaintext(encryptedPlaintext: TransformedEncryptedMessage, userPrivateKey: PrivateKey<Buffer>) {
    return Future.tryF(() => {
        const decryptedPlaintext = RecryptApi.decrypt(transformedPlaintextToEncryptedValue(encryptedPlaintext), userPrivateKey);
        return [decryptedPlaintext, RecryptApi.hash256(decryptedPlaintext)];
    });
}

/**
 * Generate a signature to be used as part of a device add operation
 * @param {String}               jwtToken          JWT token authorizing the current user
 * @param {KeyPair}              userMasterKeyPair Users public/private master keys
 * @param {Recrypt.TransformKey} deviceTransform   Device transform key
 */
export function generateDeviceAddSignature(jwtToken: string, userMasterKeyPair: KeyPair, deviceTransform: Recrypt.TransformKey) {
    const ts = Date.now();

    return Future.tryF(() => {
        const signatureMessage = Buffer.concat([
            Buffer.from(`${ts}`, "utf8"),
            Recrypt.transformKeyToBytes256(deviceTransform),
            Buffer.from(jwtToken, "utf8"),
            userMasterKeyPair.publicKey.x,
            userMasterKeyPair.publicKey.y,
        ]);
        return {
            signature: RecryptApi.schnorrSign(userMasterKeyPair.privateKey, userMasterKeyPair.publicKey, signatureMessage),
            ts,
        };
    });
}
