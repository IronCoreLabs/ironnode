import Future from "futurejs";
import * as Initialization from "../Initialization";
import ApiState from "../../lib/ApiState";
import UserApi from "../../api/UserApi";
import {ErrorCodes} from "../../Constants";
import {Codec} from "../../lib/Utils";
import * as AES from "../../crypto/AES";
import * as Recrypt from "../../crypto/Recrypt";
import * as TestUtils from "../../tests/TestUtils";

describe("Initialization", () => {
    describe("initialize", () => {
        let stateSpy: jest.SpyInstance;
        let apiSpy: jest.SpyInstance;
        beforeEach(() => {
            stateSpy = jest.spyOn(ApiState, "setAccountContext");
            apiSpy = jest.spyOn(UserApi, "getAccountContextPublicKey");
            stateSpy.mockImplementation(() => Future.of(undefined));
        });

        test("should fail if no results are returned from API", () => {
            apiSpy.mockReturnValue(
                Future.of({
                    result: [],
                })
            );

            Initialization.initialize("user-10", 3, "base64", "base64").engage(
                (e) => {
                    expect(e.code).toEqual(ErrorCodes.INITIALIZE_INVALID_ACCOUNT_ID);
                    expect(stateSpy).not.toHaveBeenCalled();
                },
                () => fail("Future should not resolve when no user ID was found")
            );
        });

        test("should resolve successfully and set api state context", () => {
            apiSpy.mockReturnValue(
                Future.of({
                    result: [
                        {
                            id: "user-10",
                            userMasterPublicKey: Codec.PublicKey.toBase64({x: Buffer.from([78, 98, 38]), y: Buffer.from([83, 93, 103, 111])}),
                        },
                    ],
                })
            );

            Initialization.initialize(
                "user-10",
                3,
                Codec.Buffer.toBase64(Buffer.from([72, 34, 115, 12])),
                Codec.Buffer.toBase64(Buffer.from([35, 98, 66]))
            ).engage(
                (e) => fail(e),
                (result) => {
                    expect(result).toBeObject();
                    expect(apiSpy).toHaveBeenCalledWith("user-10", 3, "I2JC");
                    expect(stateSpy).toHaveBeenCalledWith(
                        "user-10",
                        3,
                        {x: Buffer.from([78, 98, 38]), y: Buffer.from([83, 93, 103, 111])},
                        Buffer.from([72, 34, 115, 12]),
                        Buffer.from([35, 98, 66])
                    );
                }
            );
        });
    });

    describe("userVerify", () => {
        test("invokes user verify result and returns undefined if no users exists", () => {
            const verifySpy = jest.spyOn(UserApi, "callUserVerifyApi");
            verifySpy.mockReturnValue(Future.of(undefined));

            Initialization.userVerify("jwt").engage(
                (e) => fail(e),
                (result) => {
                    expect(result).toBeUndefined();
                }
            );
        });

        test("invokes user verify result and returns user fields if they exist", () => {
            const verifySpy = jest.spyOn(UserApi, "callUserVerifyApi");
            verifySpy.mockReturnValue(
                Future.of({
                    id: "353",
                    segmentId: 3,
                    status: 232,
                    userMasterPublicKey: "abc",
                })
            );

            Initialization.userVerify("jwt").engage(
                (e) => fail(e),
                (result) => {
                    expect(result).toEqual({
                        accountID: "353",
                        segmentID: 3,
                        userMasterPublicKey: "abc",
                    });
                }
            );
        });
    });

    describe("createUser", () => {
        test("maps failures to expected error code", (done) => {
            jest.spyOn(Recrypt, "generateKeyPair").mockReturnValue(Future.reject(new Error("forced failure")));
            jest.spyOn(UserApi, "callUserVerifyApi").mockReturnValue(Future.of(undefined));

            Initialization.createUser("jwt", "password").engage(
                (e) => {
                    expect(e.code).toEqual(ErrorCodes.USER_MASTER_KEY_GENERATION_FAILURE);
                    done();
                },
                () => fail("Shouldnt resolve when key pair generation fails.")
            );
        });

        test("returns existing user is they already exists from verify", () => {
            const verifySpy = jest.spyOn(UserApi, "callUserVerifyApi");
            verifySpy.mockReturnValue(
                Future.of({
                    id: "353",
                    segmentId: 3,
                    status: 232,
                    userMasterPublicKey: "abc",
                })
            );

            Initialization.createUser("jwt", "password").engage(
                (e) => fail(e),
                (result) => {
                    expect(result).toEqual({
                        accountID: "353",
                        segmentID: 3,
                        userMasterPublicKey: "abc",
                    });
                }
            );
        });

        test("creates new user with jwt and provided password", (done) => {
            jest.spyOn(UserApi, "callUserVerifyApi").mockReturnValue(Future.of(undefined));
            const createSpy = jest.spyOn(UserApi, "callUserCreateApi").mockReturnValue(
                Future.of({
                    id: "353",
                    segmentId: 3,
                    status: 232,
                    userMasterPublicKey: "abc",
                })
            );

            Initialization.createUser("jwt", "password").engage(
                (e) => fail(e),
                (result) => {
                    expect(result).toEqual({
                        accountID: "353",
                        segmentID: 3,
                        userMasterPublicKey: "abc",
                    });
                    expect(createSpy).toHaveBeenCalledWith("jwt", {x: expect.any(Buffer), y: expect.any(Buffer)}, expect.any(Buffer));
                    done();
                }
            );
        });
    });

    describe("generateDevice", () => {
        test("rejects if user doesnt exist", () => {
            jest.spyOn(UserApi, "callUserVerifyApi").mockReturnValue(Future.of(undefined));

            Initialization.generateDevice("jwt", "password").engage(
                (e) => {
                    expect(e.code).toEqual(0);
                },
                () => fail("Should not resolve if user doesnt exist when trying to add a device.")
            );
        });

        test("maps failures to expected error code", (done) => {
            jest.spyOn(Recrypt, "generateKeyPair").mockReturnValue(Future.reject(new Error("forced failure")));
            jest.spyOn(AES, "decryptUserMasterKey").mockReturnValue(Future.of(Buffer.alloc(32)));
            jest.spyOn(UserApi, "callUserVerifyApi").mockReturnValue(
                Future.of({
                    id: "353",
                    segmentId: 3,
                    status: 232,
                    userMasterPublicKey: TestUtils.accountPublicBytesBase64,
                    userPrivateKey: Buffer.alloc(96).toString("base64"),
                })
            );

            Initialization.generateDevice("jwt", "password").engage(
                (e) => {
                    expect(e.code).toEqual(ErrorCodes.USER_DEVICE_KEY_GENERATION_FAILURE);
                    done();
                },
                () => fail("Shouldnt resolve when key pair generation fails.")
            );
        });

        test("generates new user keypair and returns expected structure", (done) => {
            jest.spyOn(UserApi, "callUserVerifyApi").mockReturnValue(
                Future.of({
                    id: "353",
                    segmentId: 3,
                    status: 232,
                    userMasterPublicKey: TestUtils.accountPublicBytesBase64,
                    userPrivateKey: Buffer.alloc(96).toString("base64"),
                })
            );
            jest.spyOn(AES, "decryptUserMasterKey").mockReturnValue(Future.of(Buffer.alloc(32)));
            const deviceAddSpy = jest.spyOn(UserApi, "callUserDeviceAdd");
            deviceAddSpy.mockReturnValue(
                Future.of({
                    devicePublicKey: TestUtils.getEmptyPublicKey(),
                })
            );

            Initialization.generateDevice("jwt", "password").engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result.accountID).toEqual("353");
                    expect(result.segmentID).toEqual(3);
                    expect(result.deviceKeys).toEqual({
                        publicKey: {
                            x: expect.any(String),
                            y: expect.any(String),
                        },
                        privateKey: expect.any(String),
                    });
                    expect(result.signingKeys).toEqual({
                        publicKey: expect.any(String),
                        privateKey: expect.any(String),
                    });
                    expect(deviceAddSpy).toHaveBeenCalledWith(
                        "jwt",
                        {x: expect.any(Buffer), y: expect.any(Buffer)},
                        expect.any(Object),
                        expect.any(Buffer),
                        expect.any(Number)
                    );
                    done();
                }
            );
        });
    });
});
