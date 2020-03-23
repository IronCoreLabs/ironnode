"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Recrypt_1 = require("../crypto/Recrypt");
class ApiState {
    setAccountContext(accountID, segmentID, accountPublicKey, accountEncryptedPrivateKey, privateDeviceKey, privateSigningKey, currentKeyId) {
        this.accountID = accountID;
        this.segmentID = segmentID;
        this.currentKeyId = currentKeyId;
        this.accountPublicKeyBytes = accountPublicKey;
        this.accountEncryptedPublicKeyBytes = accountEncryptedPrivateKey;
        this.privateDeviceKey = privateDeviceKey;
        this.privateSigningKey = privateSigningKey;
        this.publicSigningKey = Recrypt_1.computeEd25519PublicKey(this.privateSigningKey);
    }
    setEncryptedPrivateUserKey(key) {
        this.accountEncryptedPublicKeyBytes = key;
    }
    accountPublicKey() {
        return this.accountPublicKeyBytes;
    }
    accountEncryptedPrivateKey() {
        return this.accountEncryptedPublicKeyBytes;
    }
    devicePrivateKey() {
        return this.privateDeviceKey;
    }
    signingKeys() {
        return {
            publicKey: this.publicSigningKey,
            privateKey: this.privateSigningKey,
        };
    }
    accountAndSegmentIDs() {
        return {
            accountID: this.accountID,
            segmentID: this.segmentID,
        };
    }
    keyId() {
        return this.currentKeyId;
    }
}
exports.default = new ApiState();
