import {PrivateKey, PublicKey, SigningPublicKey} from "../commonTypes";
import {computeEd25519PublicKey} from "../crypto/Recrypt";

class ApiState {
    private accountID!: string;
    private segmentID!: number;
    private currentKeyId!: number;

    private accountPublicKeyBytes!: PublicKey<Buffer>;
    private accountEncryptedPublicKeyBytes!: PrivateKey<Buffer>;

    private publicSigningKey!: SigningPublicKey<Buffer>;

    private privateDeviceKey!: PrivateKey<Buffer>;
    private privateSigningKey!: PrivateKey<Buffer>;

    /**
     * Set fields provided as part of SDK initialization. Set account and segment IDs, master public key, private device key, and private signing key
     */
    setAccountContext(
        accountID: string,
        segmentID: number,
        accountPublicKey: PublicKey<Buffer>,
        accountEncryptedPrivateKey: PrivateKey<Buffer>,
        privateDeviceKey: PrivateKey<Buffer>,
        privateSigningKey: PrivateKey<Buffer>,
        currentKeyId: number
    ) {
        this.accountID = accountID;
        this.segmentID = segmentID;
        this.currentKeyId = currentKeyId;

        this.accountPublicKeyBytes = accountPublicKey;
        this.accountEncryptedPublicKeyBytes = accountEncryptedPrivateKey;
        this.privateDeviceKey = privateDeviceKey;

        this.privateSigningKey = privateSigningKey;
        this.publicSigningKey = computeEd25519PublicKey(this.privateSigningKey);
    }

    /**
     * Reset the users encrypted private key in memory. Used after the users master private key has been rotated
     */
    setEncryptedPrivateUserKey(key: Buffer) {
        this.accountEncryptedPublicKeyBytes = key;
    }

    /**
     * Return the public key of the account being used.
     */
    accountPublicKey() {
        return this.accountPublicKeyBytes;
    }

    /**
     * Return the bytes for the users master encrypted private key
     */
    accountEncryptedPrivateKey() {
        return this.accountEncryptedPublicKeyBytes;
    }

    /**
     * Return the accounts public device key
     */
    devicePrivateKey() {
        return this.privateDeviceKey;
    }

    /**
     * Return the accounts public and private signing key pair
     */
    signingKeys() {
        return {
            publicKey: this.publicSigningKey,
            privateKey: this.privateSigningKey,
        };
    }

    /**
     * Get account ID and segment ID that it is associated with
     */
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

export default new ApiState();
