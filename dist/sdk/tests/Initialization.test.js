"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const UserApi_1 = require("../../api/UserApi");
const Constants_1 = require("../../Constants");
const AES = require("../../crypto/AES");
const Recrypt = require("../../crypto/Recrypt");
const ApiState_1 = require("../../lib/ApiState");
const Utils_1 = require("../../lib/Utils");
const TestUtils = require("../../tests/TestUtils");
const Initialization = require("../Initialization");
describe("Initialization", () => {
    describe("initialize", () => {
        let stateSpy;
        let apiSpy;
        beforeEach(() => {
            stateSpy = jest.spyOn(ApiState_1.default, "setAccountContext");
            apiSpy = jest.spyOn(UserApi_1.default, "getAccountContextPublicKey");
            stateSpy.mockImplementation(() => futurejs_1.default.of(undefined));
        });
        test("should resolve successfully and set api state context", () => {
            apiSpy.mockReturnValue(futurejs_1.default.of({
                id: "user-10",
                userMasterPublicKey: Utils_1.Codec.PublicKey.toBase64({ x: Buffer.from([78, 98, 38]), y: Buffer.from([83, 93, 103, 111]) }),
                currentKeyId: 68,
                userPrivateKey: Buffer.from([1, 2, 3]).toString("base64"),
                needsRotation: true,
                groupsNeedingRotation: ["one"],
            }));
            Initialization.initialize("user-10", 3, Utils_1.Codec.Buffer.toBase64(Buffer.from([72, 34, 115, 12])), Utils_1.Codec.Buffer.toBase64(Buffer.from([35, 98, 66]))).engage((e) => fail(e), (result) => {
                expect(result).toBeObject();
                expect(result.userContext).toEqual({
                    userNeedsRotation: true,
                    groupsNeedingRotation: ["one"],
                });
                expect(apiSpy).toHaveBeenCalledWith("user-10", 3, "I2JC");
                expect(stateSpy).toHaveBeenCalledWith("user-10", 3, { x: Buffer.from([78, 98, 38]), y: Buffer.from([83, 93, 103, 111]) }, Buffer.from([1, 2, 3]), Buffer.from([72, 34, 115, 12]), Buffer.from([35, 98, 66]), 68);
            });
        });
    });
    describe("userVerify", () => {
        test("invokes user verify result and returns undefined if no users exists", () => {
            const verifySpy = jest.spyOn(UserApi_1.default, "callUserVerifyApi");
            verifySpy.mockReturnValue(futurejs_1.default.of(undefined));
            Initialization.userVerify("jwt").engage((e) => fail(e), (result) => {
                expect(result).toBeUndefined();
            });
        });
        test("invokes user verify result and returns user fields if they exist", () => {
            const verifySpy = jest.spyOn(UserApi_1.default, "callUserVerifyApi");
            verifySpy.mockReturnValue(futurejs_1.default.of({
                id: "353",
                segmentId: 3,
                status: 232,
                userMasterPublicKey: "abc",
                needsRotation: false,
            }));
            Initialization.userVerify("jwt").engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    accountID: "353",
                    segmentID: 3,
                    userMasterPublicKey: "abc",
                    needsRotation: false,
                });
            });
        });
    });
    describe("createUser", () => {
        test("maps failures to expected error code", (done) => {
            jest.spyOn(Recrypt, "generateKeyPair").mockReturnValue(futurejs_1.default.reject(new Error("forced failure")));
            jest.spyOn(UserApi_1.default, "callUserVerifyApi").mockReturnValue(futurejs_1.default.of(undefined));
            Initialization.createUser("jwt", "password", { needsRotation: false }).engage((e) => {
                expect(e.code).toEqual(Constants_1.ErrorCodes.USER_MASTER_KEY_GENERATION_FAILURE);
                done();
            }, () => fail("Shouldnt resolve when key pair generation fails."));
        });
        test("returns existing user is they already exists from verify", () => {
            const verifySpy = jest.spyOn(UserApi_1.default, "callUserVerifyApi");
            verifySpy.mockReturnValue(futurejs_1.default.of({
                id: "353",
                segmentId: 3,
                status: 232,
                userMasterPublicKey: "abc",
                needsRotation: false,
            }));
            Initialization.createUser("jwt", "password", { needsRotation: false }).engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    accountID: "353",
                    segmentID: 3,
                    userMasterPublicKey: "abc",
                    needsRotation: false,
                });
            });
        });
        test("creates new user with jwt and provided password", (done) => {
            jest.spyOn(UserApi_1.default, "callUserVerifyApi").mockReturnValue(futurejs_1.default.of(undefined));
            const createSpy = jest.spyOn(UserApi_1.default, "callUserCreateApi").mockReturnValue(futurejs_1.default.of({
                id: "353",
                segmentId: 3,
                status: 232,
                userMasterPublicKey: "abc",
                needsRotation: true,
            }));
            Initialization.createUser("jwt", "password", { needsRotation: true }).engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    accountID: "353",
                    segmentID: 3,
                    userMasterPublicKey: "abc",
                    needsRotation: true,
                });
                expect(createSpy).toHaveBeenCalledWith("jwt", { x: expect.any(Buffer), y: expect.any(Buffer) }, expect.any(Buffer), true);
                done();
            });
        });
    });
    describe("generateDevice", () => {
        test("rejects if user doesnt exist", () => {
            jest.spyOn(UserApi_1.default, "callUserVerifyApi").mockReturnValue(futurejs_1.default.of(undefined));
            Initialization.generateDevice("jwt", "password", { deviceName: "" }).engage((e) => {
                expect(e.code).toEqual(0);
            }, () => fail("Should not resolve if user doesnt exist when trying to add a device."));
        });
        test("maps failures to expected error code", (done) => {
            jest.spyOn(Recrypt, "generateKeyPair").mockReturnValue(futurejs_1.default.reject(new Error("forced failure")));
            jest.spyOn(AES, "decryptUserMasterKey").mockReturnValue(futurejs_1.default.of({ decryptedPrivateKey: Buffer.alloc(32), derivedKey: Buffer.alloc(24), derivedKeySalt: Buffer.alloc(12) }));
            jest.spyOn(UserApi_1.default, "callUserVerifyApi").mockReturnValue(futurejs_1.default.of({
                currentKeyId: 77,
                needsRotation: false,
                groupsNeedingRotation: [],
                id: "353",
                segmentId: 3,
                status: 232,
                userMasterPublicKey: TestUtils.accountPublicBytesBase64,
                userPrivateKey: Buffer.alloc(96).toString("base64"),
            }));
            Initialization.generateDevice("jwt", "password", { deviceName: "" }).engage((e) => {
                expect(e.code).toEqual(Constants_1.ErrorCodes.USER_DEVICE_KEY_GENERATION_FAILURE);
                done();
            }, () => fail("Shouldnt resolve when key pair generation fails."));
        });
        test("generates new user keypair and returns expected structure", (done) => {
            jest.spyOn(UserApi_1.default, "callUserVerifyApi").mockReturnValue(futurejs_1.default.of({
                currentKeyId: 77,
                needsRotation: false,
                groupsNeedingRotation: [],
                id: "353",
                segmentId: 3,
                status: 232,
                userMasterPublicKey: TestUtils.accountPublicBytesBase64,
                userPrivateKey: Buffer.alloc(96).toString("base64"),
            }));
            jest.spyOn(AES, "decryptUserMasterKey").mockReturnValue(futurejs_1.default.of({ decryptedPrivateKey: Buffer.alloc(32), derivedKey: Buffer.alloc(24), derivedKeySalt: Buffer.alloc(12) }));
            const deviceAddSpy = jest.spyOn(UserApi_1.default, "callUserDeviceAdd");
            deviceAddSpy.mockReturnValue(futurejs_1.default.of({
                devicePublicKey: TestUtils.getEmptyPublicKey(),
            }));
            Initialization.generateDevice("jwt", "password", { deviceName: "" }).engage((e) => fail(e), (result) => {
                expect(result.accountID).toEqual("353");
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
                expect(deviceAddSpy).toHaveBeenCalledWith("jwt", { x: expect.any(Buffer), y: expect.any(Buffer) }, expect.any(Object), expect.any(Buffer), expect.any(Number), { deviceName: "" });
                done();
            });
        });
        test("should accept user device name in options object", (done) => {
            jest.spyOn(UserApi_1.default, "callUserVerifyApi").mockReturnValue(futurejs_1.default.of({
                id: "353",
                segmentId: 3,
                currentKeyId: 77,
                needsRotation: false,
                groupsNeedingRotation: [],
                status: 232,
                userMasterPublicKey: TestUtils.accountPublicBytesBase64,
                userPrivateKey: Buffer.alloc(96).toString("base64"),
            }));
            jest.spyOn(AES, "decryptUserMasterKey").mockReturnValue(futurejs_1.default.of({ decryptedPrivateKey: Buffer.alloc(32), derivedKey: Buffer.alloc(24), derivedKeySalt: Buffer.alloc(12) }));
            const deviceAddSpy = jest.spyOn(UserApi_1.default, "callUserDeviceAdd");
            deviceAddSpy.mockReturnValue(futurejs_1.default.of({
                devicePublicKey: TestUtils.getEmptyPublicKey(),
            }));
            Initialization.generateDevice("jwt", "password", { deviceName: "OSX" }).engage((e) => fail(e), () => {
                expect(deviceAddSpy).toHaveBeenCalledWith("jwt", { x: expect.any(Buffer), y: expect.any(Buffer) }, expect.any(Object), expect.any(Buffer), expect.any(Number), { deviceName: "OSX" });
                done();
            });
        });
    });
});
