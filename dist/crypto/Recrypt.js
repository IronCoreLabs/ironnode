"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Recrypt = require("@ironcorelabs/recrypt-node-binding");
const futurejs_1 = require("futurejs");
const Utils_1 = require("../lib/Utils");
const RecryptApi = new Recrypt.Api256();
const isBufferAllZero = (bytes) => bytes.every((val) => val === 0);
const rotateUsersPrivateKey = (userPrivateKey) => {
    return generateKeyPair().flatMap(({ privateKey }) => {
        if (isBufferAllZero(privateKey)) {
            return futurejs_1.default.reject(new Error("Key rotation failed."));
        }
        const newPrivateKey = Recrypt.subtractPrivateKeys(userPrivateKey, privateKey);
        if (isBufferAllZero(newPrivateKey)) {
            return futurejs_1.default.reject(new Error("Key rotation failed."));
        }
        return futurejs_1.default.of({
            newPrivateKey,
            augmentationFactor: privateKey,
        });
    });
};
const rotateGroupPrivateKey = (existingGroupPrivateKey) => {
    const plaintext = RecryptApi.generatePlaintext();
    const newPrivateKey = RecryptApi.deriveSymmetricKey(plaintext);
    const augmentationFactor = Recrypt.subtractPrivateKeys(existingGroupPrivateKey, newPrivateKey);
    if (isBufferAllZero(newPrivateKey) || isBufferAllZero(augmentationFactor)) {
        return futurejs_1.default.reject(new Error("Key rotation failed."));
    }
    return futurejs_1.default.of({
        plaintext,
        augmentationFactor,
    });
};
const encryptedValueToBase64 = (encryptedValue) => ({
    encryptedMessage: Utils_1.Codec.Buffer.toBase64(encryptedValue.encryptedMessage),
    ephemeralPublicKey: Utils_1.Codec.PublicKey.toBase64(encryptedValue.ephemeralPublicKey),
    authHash: Utils_1.Codec.Buffer.toBase64(encryptedValue.authHash),
    publicSigningKey: Utils_1.Codec.Buffer.toBase64(encryptedValue.publicSigningKey),
    signature: Utils_1.Codec.Buffer.toBase64(encryptedValue.signature),
});
const transformedPlaintextToEncryptedValue = (encryptedKey) => ({
    encryptedMessage: Utils_1.Codec.Buffer.fromBase64(encryptedKey.encryptedMessage),
    ephemeralPublicKey: Utils_1.Codec.PublicKey.fromBase64(encryptedKey.ephemeralPublicKey),
    publicSigningKey: Utils_1.Codec.Buffer.fromBase64(encryptedKey.publicSigningKey),
    authHash: Utils_1.Codec.Buffer.fromBase64(encryptedKey.authHash),
    signature: Utils_1.Codec.Buffer.fromBase64(encryptedKey.signature),
    transformBlocks: encryptedKey.transformBlocks.map((transformBlock) => ({
        encryptedTempKey: Utils_1.Codec.Buffer.fromBase64(transformBlock.encryptedTempKey),
        publicKey: Utils_1.Codec.PublicKey.fromBase64(transformBlock.publicKey),
        randomTransformEncryptedTempKey: Utils_1.Codec.Buffer.fromBase64(transformBlock.randomTransformEncryptedTempKey),
        randomTransformPublicKey: Utils_1.Codec.PublicKey.fromBase64(transformBlock.randomTransformPublicKey),
    })),
});
function generateKeyPair() {
    return futurejs_1.default.tryF(() => RecryptApi.generateKeyPair());
}
exports.generateKeyPair = generateKeyPair;
function generateGroupKeyPair() {
    return futurejs_1.default.tryF(() => {
        const plaintext = RecryptApi.generatePlaintext();
        const privateKey = RecryptApi.deriveSymmetricKey(plaintext);
        return {
            privateKey,
            plaintext,
            publicKey: RecryptApi.computePublicKey(privateKey),
        };
    });
}
exports.generateGroupKeyPair = generateGroupKeyPair;
function generateTransformKey(fromPrivateKey, toPublicKey, privateSigningKey) {
    return futurejs_1.default.tryF(() => RecryptApi.generateTransformKey(fromPrivateKey, toPublicKey, privateSigningKey));
}
exports.generateTransformKey = generateTransformKey;
function generateTransformKeyToList(fromPrivateKey, publicKeyList, privateSigningKey) {
    if (!publicKeyList.length) {
        return futurejs_1.default.of([]);
    }
    const transformKeyFutures = publicKeyList.map(({ masterPublicKey, id }) => {
        return generateTransformKey(fromPrivateKey, Utils_1.Codec.PublicKey.fromBase64(masterPublicKey), privateSigningKey).map((transformKey) => ({
            transformKey,
            publicKey: masterPublicKey,
            id,
        }));
    });
    return futurejs_1.default.all(transformKeyFutures);
}
exports.generateTransformKeyToList = generateTransformKeyToList;
function generateDocumentKey() {
    return futurejs_1.default.tryF(() => {
        const plaintext = RecryptApi.generatePlaintext();
        return [plaintext, RecryptApi.deriveSymmetricKey(plaintext)];
    });
}
exports.generateDocumentKey = generateDocumentKey;
function generateEd25519KeyPair() {
    return RecryptApi.generateEd25519KeyPair();
}
exports.generateEd25519KeyPair = generateEd25519KeyPair;
function ed25519Sign(privateKey, message) {
    return RecryptApi.ed25519Sign(privateKey, message);
}
exports.ed25519Sign = ed25519Sign;
function ed25519Verify(publicKey, message, signature) {
    return RecryptApi.ed25519Verify(publicKey, message, signature);
}
exports.ed25519Verify = ed25519Verify;
function computeEd25519PublicKey(privateKey) {
    return RecryptApi.computeEd25519PublicKey(privateKey);
}
exports.computeEd25519PublicKey = computeEd25519PublicKey;
function derivePublicKey(privateKey) {
    return futurejs_1.default.tryF(() => RecryptApi.computePublicKey(privateKey));
}
exports.derivePublicKey = derivePublicKey;
function encryptPlaintext(plaintext, userPublicKey, privateSigningKey) {
    return futurejs_1.default.tryF(() => encryptedValueToBase64(RecryptApi.encrypt(plaintext, userPublicKey, privateSigningKey)));
}
exports.encryptPlaintext = encryptPlaintext;
function encryptPlaintextToList(plaintext, keyList, privateSigningKey) {
    if (!keyList.length) {
        return futurejs_1.default.of([]);
    }
    const encryptKeyFutures = keyList.map(({ masterPublicKey, id }) => {
        return encryptPlaintext(plaintext, Utils_1.Codec.PublicKey.fromBase64(masterPublicKey), privateSigningKey).map((encryptedPlaintext) => ({
            encryptedPlaintext,
            publicKey: masterPublicKey,
            id,
        }));
    });
    return futurejs_1.default.all(encryptKeyFutures);
}
exports.encryptPlaintextToList = encryptPlaintextToList;
function decryptPlaintext(encryptedPlaintext, userPrivateKey) {
    return futurejs_1.default.tryF(() => {
        const decryptedPlaintext = RecryptApi.decrypt(transformedPlaintextToEncryptedValue(encryptedPlaintext), userPrivateKey);
        return [decryptedPlaintext, RecryptApi.deriveSymmetricKey(decryptedPlaintext)];
    });
}
exports.decryptPlaintext = decryptPlaintext;
function generateDeviceAddSignature(jwtToken, userMasterKeyPair, deviceTransform) {
    const ts = Date.now();
    return futurejs_1.default.tryF(() => {
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
exports.generateDeviceAddSignature = generateDeviceAddSignature;
exports.rotateUsersPrivateKeyWithRetry = (userPrivateKey) => {
    return rotateUsersPrivateKey(userPrivateKey).handleWith(() => rotateUsersPrivateKey(userPrivateKey));
};
exports.rotateGroupPrivateKeyWithRetry = (groupPrivateKey) => {
    return rotateGroupPrivateKey(groupPrivateKey).handleWith(() => rotateGroupPrivateKey(groupPrivateKey));
};
