import * as TestUtils from "../../tests/TestUtils";
import ApiState from "../ApiState";

describe("ApiState", () => {
    test("setting context sets value for all fields", () => {
        ApiState.setAccountContext(...TestUtils.getTestApiState());

        expect(ApiState.accountAndSegmentIDs()).toEqual({
            accountID: "10",
            segmentID: 30,
        });

        expect(ApiState.accountEncryptedPrivateKey()).toEqual(TestUtils.accountEncryptedPrivateKeyBytes);

        expect(ApiState.accountPublicKey()).toEqual(TestUtils.accountPublicBytes);

        expect(ApiState.devicePrivateKey()).toEqual(TestUtils.devicePrivateBytes);

        expect(ApiState.signingKeys()).toEqual({
            //prettier-ignore
            publicKey: Buffer.from([191,198,194,108,71,19,144,15,144,232,128,27,163,12,3,171,100,32,136,198,69,71,128,255,29,204,142,14,59,243,125,118,]),
            privateKey: TestUtils.signingPrivateBytes,
        });

        expect(ApiState.keyId()).toEqual(TestUtils.testCurrentKeyId);
    });

    test("can reset encrypted private user key", () => {
        ApiState.setAccountContext(...TestUtils.getTestApiState());

        expect(ApiState.accountEncryptedPrivateKey()).toEqual(TestUtils.accountEncryptedPrivateKeyBytes);

        ApiState.setEncryptedPrivateUserKey(Buffer.alloc(92));
        expect(ApiState.accountEncryptedPrivateKey()).toEqual(Buffer.alloc(92));
    });
});
