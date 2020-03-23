"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const ApiState_1 = require("../../lib/ApiState");
const TestUtils = require("../../tests/TestUtils");
const ApiRequest = require("../ApiRequest");
const UserApi_1 = require("../UserApi");
describe("UserApi", () => {
    beforeEach(() => {
        jest.spyOn(ApiRequest, "fetchJSON").mockReturnValue(futurejs_1.default.of({
            foo: "bar",
        }));
        return ApiState_1.default.setAccountContext(...TestUtils.getTestApiState());
    });
    afterEach(() => {
        ApiRequest.fetchJSON.mockClear();
    });
    describe("getAccountContextPublicKey", () => {
        test("calls API and returns data for provided user", (done) => {
            ApiRequest.fetchJSON.mockReturnValue(futurejs_1.default.of({
                result: [{ id: "svc-user", userMasterPublicKey: { x: "" } }],
            }));
            const signingPrivateKey = TestUtils.signingPrivateBytes.toString("base64");
            UserApi_1.default.getAccountContextPublicKey("svc-user", 10, signingPrivateKey).engage((error) => done.fail(error), (userList) => {
                expect(userList).toEqual({
                    result: [{ id: "svc-user", userMasterPublicKey: { x: "" } }],
                });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("users/current", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                done();
            });
        });
    });
    describe("callUserVerifyApi", () => {
        test("calls API and returns user", (done) => {
            ApiRequest.fetchJSON.mockReturnValue(futurejs_1.default.of({
                id: "abbc",
                segmentId: 22,
            }));
            UserApi_1.default.callUserVerifyApi("jwt").engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    id: "abbc",
                    segmentId: 22,
                });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("users/verify?returnKeys=true", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toEqual("jwt jwt");
                done();
            });
        });
        test("calls API and returns undefined if the user doesnt exist", (done) => {
            ApiRequest.fetchJSON.mockReturnValue(futurejs_1.default.of(null));
            UserApi_1.default.callUserVerifyApi("jwt").engage((e) => fail(e), (result) => {
                expect(result).toBeUndefined();
                done();
            });
        });
    });
    describe("callUserCreateApi", () => {
        test("calls API and returns mapped response data", (done) => {
            ApiRequest.fetchJSON.mockReturnValue(futurejs_1.default.of({
                id: "abbc",
                segmentId: 22,
            }));
            UserApi_1.default.callUserCreateApi("jwt", TestUtils.getEmptyPublicKey(), Buffer.alloc(5), false).engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    id: "abbc",
                    segmentId: 22,
                });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("users", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toEqual("jwt jwt");
                expect(request.method).toEqual("POST");
                expect(JSON.parse(request.body)).toEqual({
                    userPrivateKey: "AAAAAAA=",
                    userPublicKey: { x: "", y: "" },
                    needsRotation: false,
                });
                done();
            });
        });
    });
    describe("callUserKeyUpdateApi", () => {
        test("calls API with new key and returns response", (done) => {
            ApiRequest.fetchJSON.mockReturnValue(futurejs_1.default.of({
                currentKeyId: 83,
                userPrivateKey: "AAAA",
                needsRotation: false,
            }));
            UserApi_1.default.callUserKeyUpdateApi(Buffer.alloc(3), Buffer.alloc(5)).engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    currentKeyId: 83,
                    userPrivateKey: "AAAA",
                    needsRotation: false,
                });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith(`users/${TestUtils.testAccountID}/keys/${TestUtils.testCurrentKeyId}`, jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                expect(request.method).toEqual("PUT");
                expect(JSON.parse(request.body)).toEqual({
                    userPrivateKey: "AAAA",
                    augmentationFactor: "AAAAAAA=",
                });
                done();
            });
        });
    });
    describe("callUserDeviceAdd", () => {
        test("calls API and returns mapped response data", (done) => {
            ApiRequest.fetchJSON.mockReturnValue(futurejs_1.default.of({
                devicePublicKey: { x: "", y: "" },
            }));
            UserApi_1.default.callUserDeviceAdd("jwt", TestUtils.getEmptyPublicKey(), TestUtils.getTransformKey(), Buffer.from([99, 103, 113, 93]), 133353523, {
                deviceName: "blah",
            }).engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    devicePublicKey: { x: "", y: "" },
                });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("users/devices", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toEqual("jwt jwt");
                expect(request.method).toEqual("POST");
                expect(JSON.parse(request.body)).toEqual({
                    timestamp: 133353523,
                    userPublicKey: { x: "", y: "" },
                    device: {
                        transformKey: {
                            ephemeralPublicKey: { x: "", y: "" },
                            toPublicKey: { x: "", y: "" },
                            encryptedTempKey: "",
                            hashedTempKey: "",
                            publicSigningKey: "",
                            signature: "",
                        },
                        name: "blah",
                    },
                    signature: "Y2dxXQ==",
                });
                done();
            });
        });
        test("shouldnt pass device name if not provided", (done) => {
            ApiRequest.fetchJSON.mockReturnValue(futurejs_1.default.of({
                devicePublicKey: { x: "", y: "" },
            }));
            UserApi_1.default.callUserDeviceAdd("jwt", TestUtils.getEmptyPublicKey(), TestUtils.getTransformKey(), Buffer.from([99, 103, 113, 93]), 133353523, {
                deviceName: "",
            }).engage((e) => fail(e), () => {
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(JSON.parse(request.body)).toEqual({
                    timestamp: 133353523,
                    userPublicKey: { x: "", y: "" },
                    device: {
                        transformKey: {
                            ephemeralPublicKey: { x: "", y: "" },
                            toPublicKey: { x: "", y: "" },
                            encryptedTempKey: "",
                            hashedTempKey: "",
                            publicSigningKey: "",
                            signature: "",
                        },
                    },
                    signature: "Y2dxXQ==",
                });
                done();
            });
        });
    });
    describe("callUserKeyListApi", () => {
        test("calls API and returns mapped response data", (done) => {
            ApiRequest.fetchJSON.mockReturnValue(futurejs_1.default.of({
                result: [
                    { id: "user-10", userMasterPublicKey: { x: "" } },
                    { id: "user-20", userMasterPublicKey: { x: "" } },
                ],
            }));
            UserApi_1.default.callUserKeyListApi(["user-10", "user-20-!@#$%"]).engage((error) => done.fail(error), (userList) => {
                expect(userList).toEqual({
                    result: [
                        { id: "user-10", userMasterPublicKey: { x: "" } },
                        { id: "user-20", userMasterPublicKey: { x: "" } },
                    ],
                });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("users?id=user-10%2Cuser-20-!%40%23%24%25", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                done();
            });
        });
        test("returns empty result when no keys provided", (done) => {
            UserApi_1.default.callUserKeyListApi([]).engage((e) => done.fail(e), (result) => {
                expect(result).toEqual({ result: [] });
                expect(ApiRequest.fetchJSON).not.toHaveBeenCalled();
                done();
            });
        });
    });
    describe("callUserUpdatePrivateKey", () => {
        test("calls API with newly encrypted key", () => {
            UserApi_1.default.callUserUpdatePrivateKey(Buffer.from([95, 97, 92, 83])).engage((e) => fail(e), (res) => {
                expect(res).toEqual({ foo: "bar" });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("users/10", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                expect(JSON.parse(request.body)).toEqual({
                    userPrivateKey: "X2FcUw==",
                });
            });
        });
    });
    describe("callUserDeviceListApi", () => {
        test("calls API and returns response", (done) => {
            const deviceListResult = {
                result: [
                    { id: 35, name: "device1", created: 123, updated: 345 },
                    { id: 83, name: "device2", created: 678, updated: 901 },
                ],
            };
            ApiRequest.fetchJSON.mockReturnValue(futurejs_1.default.of(deviceListResult));
            UserApi_1.default.callUserDeviceListApi().engage((error) => done.fail(error), (deviceList) => {
                expect(deviceList).toEqual(deviceListResult);
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith(`users/${TestUtils.testAccountID}/devices`, jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                done();
            });
        });
    });
    describe("callUserDeviceDeleteApi", () => {
        test("calls delete API and returns response", (done) => {
            const deviceDeleteResult = { id: 35352 };
            ApiRequest.fetchJSON.mockReturnValue(futurejs_1.default.of(deviceDeleteResult));
            UserApi_1.default.callUserDeviceDeleteApi(35352).engage((error) => done.fail(error), (deletedDevice) => {
                expect(deletedDevice).toEqual(deviceDeleteResult);
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith(`users/${TestUtils.testAccountID}/devices/35352`, jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                expect(request.method).toEqual("DELETE");
                done();
            });
        });
        test("deletes the current device if no ID provided", (done) => {
            const deviceDeleteResult = { id: 35352 };
            ApiRequest.fetchJSON.mockReturnValue(futurejs_1.default.of(deviceDeleteResult));
            UserApi_1.default.callUserDeviceDeleteApi().engage((error) => done.fail(error), (deletedDevice) => {
                expect(deletedDevice).toEqual(deviceDeleteResult);
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith(`users/${TestUtils.testAccountID}/devices/current`, jasmine.any(Number), jasmine.any(Object));
                done();
            });
        });
    });
});
