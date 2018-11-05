import Future from "futurejs";
import * as UserOperations from "../UserOperations";
import UserApi from "../../api/UserApi";
import * as TestUtils from "../../tests/TestUtils";
import ApiState from "../../lib/ApiState";

describe("UserOperations", () => {
    beforeEach(() => {
        ApiState.setAccountContext(
            TestUtils.testAccountID,
            TestUtils.testSegmentID,
            TestUtils.accountPublicBytes,
            TestUtils.devicePrivateBytes,
            TestUtils.signingPrivateBytes
        );
    });

    describe("getUserPublicKeys", () => {
        test("returns results mapped by ID", () => {
            const userKeys = jest.spyOn(UserApi, "callUserKeyListApi");
            userKeys.mockReturnValue(
                Future.of({
                    result: [
                        {
                            id: "userID1",
                            userMasterPublicKey: {x: "", y: ""},
                        },
                        {
                            id: "userID2",
                            userMasterPublicKey: {x: "2", y: "2"},
                        },
                        {
                            id: "userID3",
                            userMasterPublicKey: {x: "3", y: "3"},
                        },
                    ],
                })
            );

            UserOperations.getUserPublicKeys(["userID1", "userID2", "userID3"]).engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toEqual({
                        userID1: {x: "", y: ""},
                        userID2: {x: "2", y: "2"},
                        userID3: {x: "3", y: "3"},
                    });
                }
            );
        });

        test("sets values for missing keys as null", () => {
            const userKeys = jest.spyOn(UserApi, "callUserKeyListApi");
            userKeys.mockReturnValue(
                Future.of({
                    result: [
                        {
                            id: "userID1",
                            userMasterPublicKey: {x: "", y: ""},
                        },
                        {
                            id: "userID2",
                            userMasterPublicKey: {x: "2", y: "2"},
                        },
                    ],
                })
            );

            UserOperations.getUserPublicKeys(["userID0", "userID1", "userID2", "userID3"]).engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toEqual({
                        userID0: null,
                        userID1: {x: "", y: ""},
                        userID2: {x: "2", y: "2"},
                        userID3: null,
                    });
                }
            );
        });
    });
});
