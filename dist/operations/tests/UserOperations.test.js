"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const UserApi_1 = require("../../api/UserApi");
const ApiState_1 = require("../../lib/ApiState");
const TestUtils = require("../../tests/TestUtils");
const UserCrypto = require("../UserCrypto");
const UserOperations = require("../UserOperations");
describe("UserOperations", () => {
    beforeEach(() => {
        ApiState_1.default.setAccountContext(...TestUtils.getTestApiState());
    });
    describe("getUserPublicKeys", () => {
        test("returns results mapped by ID", () => {
            const userKeys = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userKeys.mockReturnValue(futurejs_1.default.of({
                result: [
                    {
                        id: "userID1",
                        userMasterPublicKey: { x: "", y: "" },
                    },
                    {
                        id: "userID2",
                        userMasterPublicKey: { x: "2", y: "2" },
                    },
                    {
                        id: "userID3",
                        userMasterPublicKey: { x: "3", y: "3" },
                    },
                ],
            }));
            UserOperations.getUserPublicKeys(["userID1", "userID2", "userID3"]).engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    userID1: { x: "", y: "" },
                    userID2: { x: "2", y: "2" },
                    userID3: { x: "3", y: "3" },
                });
            });
        });
        test("sets values for missing keys as null", () => {
            const userKeys = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userKeys.mockReturnValue(futurejs_1.default.of({
                result: [
                    {
                        id: "userID1",
                        userMasterPublicKey: { x: "", y: "" },
                    },
                    {
                        id: "userID2",
                        userMasterPublicKey: { x: "2", y: "2" },
                    },
                ],
            }));
            UserOperations.getUserPublicKeys(["userID0", "userID1", "userID2", "userID3"]).engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    userID0: null,
                    userID1: { x: "", y: "" },
                    userID2: { x: "2", y: "2" },
                    userID3: null,
                });
            });
        });
    });
    describe("getUserDevices", () => {
        test("calls user device list API", () => {
            const deviceList = jest.spyOn(UserApi_1.default, "callUserDeviceListApi");
            deviceList.mockReturnValue(futurejs_1.default.of({ result: [{ id: 353, name: "device1" }] }));
            UserOperations.getUserDevices().engage((e) => fail(e), (result) => {
                expect(result).toEqual({ result: [{ id: 353, name: "device1" }] });
            });
        });
    });
    describe("deleteUserDevice", () => {
        test("calls user device delete API", () => {
            const deviceDelete = jest.spyOn(UserApi_1.default, "callUserDeviceDeleteApi");
            deviceDelete.mockReturnValue(futurejs_1.default.of({ id: 352 }));
            UserOperations.deleteUserDevice(352).engage((e) => fail(e), (result) => {
                expect(result).toEqual({ id: 352 });
                expect(UserApi_1.default.callUserDeviceDeleteApi).toHaveBeenCalledWith(352);
            });
        });
    });
    describe("rotateMasterKey", () => {
        test("rotates key, saves it to the API, and then sets result in ApiState", () => {
            expect(ApiState_1.default.accountEncryptedPrivateKey()).toEqual(TestUtils.accountEncryptedPrivateKeyBytes);
            jest.spyOn(UserCrypto, "rotateUsersPrivateKey").mockReturnValue(futurejs_1.default.of({
                newEncryptedPrivateUserKey: Buffer.from([1, 2, 3]),
                augmentationFactor: Buffer.from([8, 9, 10]),
            }));
            jest.spyOn(UserApi_1.default, "callUserKeyUpdateApi").mockReturnValue(futurejs_1.default.of({ needsRotation: false }));
            UserOperations.rotateMasterKey("password").engage((e) => fail(e), (resp) => {
                expect(resp).toEqual({ needsRotation: false });
                expect(ApiState_1.default.accountEncryptedPrivateKey()).toEqual(Buffer.from([1, 2, 3]));
            });
        });
    });
    describe("changeUsersPassword", () => {
        test("changes encrypted key and saves it to the API", (done) => {
            jest.spyOn(UserCrypto, "reencryptUserMasterPrivateKey").mockReturnValue(futurejs_1.default.of(Buffer.from("newKey!")));
            jest.spyOn(UserApi_1.default, "callUserUpdatePrivateKey").mockReturnValue(futurejs_1.default.of(undefined));
            expect(ApiState_1.default.accountEncryptedPrivateKey()).toEqual(TestUtils.accountEncryptedPrivateKeyBytes);
            UserOperations.changeUsersPassword("currentPass", "newPass").engage((e) => fail(e), (res) => {
                expect(res).toBeUndefined();
                expect(ApiState_1.default.accountEncryptedPrivateKey()).toEqual(Buffer.from("newKey!"));
                done();
            });
        });
    });
});
