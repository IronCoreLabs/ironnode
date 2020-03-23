"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TestUtils = require("../../tests/TestUtils");
const ApiState_1 = require("../ApiState");
describe("ApiState", () => {
    test("setting context sets value for all fields", () => {
        ApiState_1.default.setAccountContext(...TestUtils.getTestApiState());
        expect(ApiState_1.default.accountAndSegmentIDs()).toEqual({
            accountID: "10",
            segmentID: 30,
        });
        expect(ApiState_1.default.accountEncryptedPrivateKey()).toEqual(TestUtils.accountEncryptedPrivateKeyBytes);
        expect(ApiState_1.default.accountPublicKey()).toEqual(TestUtils.accountPublicBytes);
        expect(ApiState_1.default.devicePrivateKey()).toEqual(TestUtils.devicePrivateBytes);
        expect(ApiState_1.default.signingKeys()).toEqual({
            publicKey: Buffer.from([191, 198, 194, 108, 71, 19, 144, 15, 144, 232, 128, 27, 163, 12, 3, 171, 100, 32, 136, 198, 69, 71, 128, 255, 29, 204, 142, 14, 59, 243, 125, 118,]),
            privateKey: TestUtils.signingPrivateBytes,
        });
        expect(ApiState_1.default.keyId()).toEqual(TestUtils.testCurrentKeyId);
    });
    test("can reset encrypted private user key", () => {
        ApiState_1.default.setAccountContext(...TestUtils.getTestApiState());
        expect(ApiState_1.default.accountEncryptedPrivateKey()).toEqual(TestUtils.accountEncryptedPrivateKeyBytes);
        ApiState_1.default.setEncryptedPrivateUserKey(Buffer.alloc(92));
        expect(ApiState_1.default.accountEncryptedPrivateKey()).toEqual(Buffer.alloc(92));
    });
});
