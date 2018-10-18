import ApiState from "../ApiState";
import * as TestUtils from "../../tests/TestUtils";

test("ApiState", () => {
    ApiState.setAccountContext(
        TestUtils.testAccountID,
        TestUtils.testSegmentID,
        TestUtils.accountPublicBytes,
        TestUtils.devicePrivateBytes,
        TestUtils.signingPrivateBytes
    );

    expect(ApiState.accountAndSegmentIDs()).toEqual({
        accountID: "10",
        segmentID: 30,
    });

    expect(ApiState.accountPublicKey()).toEqual(TestUtils.accountPublicBytes);

    expect(ApiState.devicePrivateKey()).toEqual(TestUtils.devicePrivateBytes);

    expect(ApiState.signingKeys()).toEqual({
        publicKey: Buffer.from([
            191,
            198,
            194,
            108,
            71,
            19,
            144,
            15,
            144,
            232,
            128,
            27,
            163,
            12,
            3,
            171,
            100,
            32,
            136,
            198,
            69,
            71,
            128,
            255,
            29,
            204,
            142,
            14,
            59,
            243,
            125,
            118,
        ]),
        privateKey: TestUtils.signingPrivateBytes,
    });
});
