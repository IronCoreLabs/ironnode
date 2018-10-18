import {computeEd25519PublicKey} from "../crypto/Recrypt";
import {PublicKey, SigningPublicKey, PrivateKey} from "../commonTypes";

class ApiState {
    private accountID!: string;
    private segmentID!: number;

    private accountPublicKeyBytes!: PublicKey<Buffer>;

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
        privateDeviceKey: PrivateKey<Buffer>,
        privateSigningKey: PrivateKey<Buffer>
    ) {
        this.accountID = accountID;
        this.segmentID = segmentID;

        this.accountPublicKeyBytes = accountPublicKey;
        this.privateDeviceKey = privateDeviceKey;

        this.privateSigningKey = privateSigningKey;
        this.publicSigningKey = computeEd25519PublicKey(this.privateSigningKey);
    }

    /**
     * Return the public key of the account being used.
     */
    accountPublicKey() {
        return this.accountPublicKeyBytes;
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
}

export default new ApiState();
