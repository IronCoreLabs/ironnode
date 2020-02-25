import Future from "futurejs";
import UserApi from "../../api/UserApi";
import ApiState from "../../lib/ApiState";
import * as TestUtils from "../../tests/TestUtils";
import * as UserCrypto from "../UserCrypto";
import * as UserOperations from "../UserOperations";

describe("UserOperations", () => {
    beforeEach(() => {
        ApiState.setAccountContext(...TestUtils.getTestApiState());
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

    describe("getUserDevices", () => {
        test("calls user device list API", () => {
            const deviceList = jest.spyOn(UserApi, "callUserDeviceListApi");
            deviceList.mockReturnValue(Future.of({result: [{id: 353, name: "device1"}]}) as any);

            UserOperations.getUserDevices().engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toEqual({result: [{id: 353, name: "device1"}]});
                }
            );
        });
    });

    describe("deleteUserDevice", () => {
        test("calls user device delete API", () => {
            const deviceDelete = jest.spyOn(UserApi, "callUserDeviceDeleteApi");
            deviceDelete.mockReturnValue(Future.of({id: 352}));

            UserOperations.deleteUserDevice(352).engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toEqual({id: 352});
                    expect(UserApi.callUserDeviceDeleteApi).toHaveBeenCalledWith(352);
                }
            );
        });
    });

    describe("rotateMasterKey", () => {
        test("rotates key, saves it to the API, and then sets result in ApiState", () => {
            expect(ApiState.accountEncryptedPrivateKey()).toEqual(TestUtils.accountEncryptedPrivateKeyBytes);

            jest.spyOn(UserCrypto, "rotateUsersPrivateKey").mockReturnValue(
                Future.of({
                    newEncryptedPrivateUserKey: Buffer.from([1, 2, 3]),
                    augmentationFactor: Buffer.from([8, 9, 10]),
                })
            );

            jest.spyOn(UserApi, "callUserKeyUpdateApi").mockReturnValue(Future.of({needsRotation: false} as any));

            UserOperations.rotateMasterKey("password").engage(
                (e) => fail(e),
                (resp) => {
                    expect(resp).toEqual({needsRotation: false});
                    expect(ApiState.accountEncryptedPrivateKey()).toEqual(Buffer.from([1, 2, 3]));
                }
            );
        });
    });
});
