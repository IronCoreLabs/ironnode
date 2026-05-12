import Future from "futurejs";
import UserApi from "../../api/UserApi";
import {ErrorCodes} from "../../Constants";
import ApiState from "../../lib/ApiState";
import * as SDKState from "../../lib/SDKState";
import * as TestUtils from "../../tests/TestUtils";
import * as UserCrypto from "../UserCrypto";
import * as UserOperations from "../UserOperations";

describe("UserOperations", () => {
    beforeEach(() => {
        ApiState.setAccountContext(...TestUtils.getTestApiState());
        SDKState.setSDKInitialized();
    });

    afterEach(() => {
        SDKState.clearSDKInitialized();
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

        test("does not clear ApiState when deleting an arbitrary device by ID", (done) => {
            // Deleting a different device must not revoke the current session, so the
            // local keys remain intact and subsequent SDK calls keep working.
            jest.spyOn(UserApi, "callUserDeviceDeleteApi").mockReturnValue(Future.of({id: 352}));

            UserOperations.deleteUserDevice(352).engage(
                (e) => done.fail(e),
                () => {
                    expect(ApiState.accountAndSegmentIDs().accountID).toEqual(TestUtils.testAccountID);
                    expect(ApiState.devicePrivateKey()).toEqual(TestUtils.devicePrivateBytes);
                    done();
                }
            );
        });

        test("clears ApiState and the init flag when called with no device ID (current-device delete)", (done) => {
            // The server revokes the current device's keys, so leaving them in process
            // memory would let the next SDK call sign with revoked keys and fail with a
            // confusing 401 instead of a clean local error.
            expect(ApiState.accountAndSegmentIDs().accountID).toEqual(TestUtils.testAccountID);
            expect(SDKState.isSDKInitialized()).toBe(true);

            jest.spyOn(UserApi, "callUserDeviceDeleteApi").mockReturnValue(Future.of({id: 99}));

            UserOperations.deleteUserDevice().engage(
                (e) => done.fail(e),
                (result: any) => {
                    expect(result).toEqual({id: 99});
                    expect(UserApi.callUserDeviceDeleteApi).toHaveBeenCalledWith(undefined);
                    expect(ApiState.accountAndSegmentIDs()).toEqual({accountID: undefined, segmentID: undefined});
                    expect(ApiState.devicePrivateKey()).toBeUndefined();
                    expect(ApiState.signingKeys().privateKey).toBeUndefined();
                    expect(SDKState.isSDKInitialized()).toBe(false);
                    done();
                }
            );
        });

        test("does not clear ApiState when the current-device delete API call fails", (done) => {
            jest.spyOn(UserApi, "callUserDeviceDeleteApi").mockReturnValue(Future.reject(new Error("server error")) as any);

            UserOperations.deleteUserDevice().engage(
                () => {
                    expect(ApiState.accountAndSegmentIDs().accountID).toEqual(TestUtils.testAccountID);
                    done();
                },
                () => done.fail("Expected deleteUserDevice to fail when the API rejects")
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

    describe("disableSelf", () => {
        test("calls status API and maps the response", (done) => {
            jest.spyOn(UserApi, "callUserDisableSelfApi").mockReturnValue(
                Future.of({
                    id: "abc",
                    status: 0,
                    segmentId: 42,
                    userMasterPublicKey: {x: "px", y: "py"},
                    needsRotation: false,
                })
            );

            UserOperations.disableSelf().engage(
                (e) => done.fail(e),
                (res) => {
                    expect(res).toEqual({
                        accountID: "abc",
                        segmentID: 42,
                        status: 0,
                        userMasterPublicKey: {x: "px", y: "py"},
                        needsRotation: false,
                    });
                    expect(UserApi.callUserDisableSelfApi).toHaveBeenCalled();
                    done();
                }
            );
        });

        test("clears the in-memory account context and init flag after a successful disable", (done) => {
            expect(ApiState.accountAndSegmentIDs().accountID).toEqual(TestUtils.testAccountID);
            expect(SDKState.isSDKInitialized()).toBe(true);

            jest.spyOn(UserApi, "callUserDisableSelfApi").mockReturnValue(
                Future.of({id: "abc", status: 0, segmentId: 42, userMasterPublicKey: {x: "", y: ""}, needsRotation: false})
            );

            UserOperations.disableSelf().engage(
                (e) => done.fail(e),
                () => {
                    expect(ApiState.accountAndSegmentIDs()).toEqual({accountID: undefined, segmentID: undefined});
                    expect(ApiState.devicePrivateKey()).toBeUndefined();
                    expect(ApiState.signingKeys().privateKey).toBeUndefined();
                    expect(ApiState.accountEncryptedPrivateKey()).toBeUndefined();
                    expect(ApiState.accountPublicKey()).toBeUndefined();
                    expect(SDKState.isSDKInitialized()).toBe(false);
                    done();
                }
            );
        });

        test("does not clear the in-memory account context when the API call fails", (done) => {
            jest.spyOn(UserApi, "callUserDisableSelfApi").mockReturnValue(Future.reject(new Error("server error")) as any);

            UserOperations.disableSelf().engage(
                () => {
                    expect(ApiState.accountAndSegmentIDs().accountID).toEqual(TestUtils.testAccountID);
                    done();
                },
                () => done.fail("Expected disableSelf to fail when the API rejects")
            );
        });
    });

    describe("updateUserStatus", () => {
        const buildJwt = (claims: object) => {
            const header = Buffer.from(JSON.stringify({alg: "ES256", typ: "JWT"})).toString("base64url");
            const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
            return `${header}.${payload}.sig`;
        };

        test("extracts user ID from JWT sub claim and calls API", (done) => {
            const jwt = buildJwt({sub: "user-from-jwt", pid: 1, sid: "seg"});
            jest.spyOn(UserApi, "callUserUpdateStatusByJwtApi").mockReturnValue(
                Future.of({
                    id: "user-from-jwt",
                    status: 1,
                    segmentId: 7,
                    userMasterPublicKey: {x: "x", y: "y"},
                    needsRotation: false,
                })
            );

            UserOperations.updateUserStatus(jwt, 1).engage(
                (e) => done.fail(e),
                (res) => {
                    expect(res).toEqual({
                        accountID: "user-from-jwt",
                        segmentID: 7,
                        status: 1,
                        userMasterPublicKey: {x: "x", y: "y"},
                        needsRotation: false,
                    });
                    expect(UserApi.callUserUpdateStatusByJwtApi).toHaveBeenCalledWith(jwt, "user-from-jwt", 1);
                    done();
                }
            );
        });

        test("rejects with JWT_FORMAT_FAILURE when JWT cannot be parsed", (done) => {
            UserOperations.updateUserStatus("not-a-jwt", 0).engage(
                (e) => {
                    expect(e.message).toMatch(/Invalid JWT/);
                    expect(e.code).toEqual(ErrorCodes.JWT_FORMAT_FAILURE);
                    done();
                },
                () => done.fail("Expected updateUserStatus to fail for malformed JWT")
            );
        });

        test("rejects with JWT_FORMAT_FAILURE when JWT is missing sub claim", (done) => {
            const jwt = buildJwt({pid: 1});
            UserOperations.updateUserStatus(jwt, 0).engage(
                (e) => {
                    expect(e.message).toMatch(/Invalid JWT/);
                    expect(e.code).toEqual(ErrorCodes.JWT_FORMAT_FAILURE);
                    done();
                },
                () => done.fail("Expected updateUserStatus to fail when sub is missing")
            );
        });
    });

    describe("changeUsersPassword", () => {
        test("changes encrypted key and saves it to the API", (done) => {
            jest.spyOn(UserCrypto, "reencryptUserMasterPrivateKey").mockReturnValue(Future.of(Buffer.from("newKey!")));
            jest.spyOn(UserApi, "callUserUpdatePrivateKey").mockReturnValue(Future.of(undefined) as any);

            expect(ApiState.accountEncryptedPrivateKey()).toEqual(TestUtils.accountEncryptedPrivateKeyBytes);

            UserOperations.changeUsersPassword("currentPass", "newPass").engage(
                (e) => fail(e),
                (res) => {
                    expect(res).toBeUndefined();
                    expect(ApiState.accountEncryptedPrivateKey()).toEqual(Buffer.from("newKey!"));
                    done();
                }
            );
        });
    });
});
