"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const ApiState_1 = require("../../lib/ApiState");
const TestUtils = require("../../tests/TestUtils");
const ApiRequest = require("../ApiRequest");
const GroupApi_1 = require("../GroupApi");
describe("GroupApi", () => {
    beforeEach(() => {
        jest.spyOn(ApiRequest, "fetchJSON").mockReturnValue(futurejs_1.default.of({
            foo: "bar",
        }));
        return ApiState_1.default.setAccountContext(...TestUtils.getTestApiState());
    });
    afterEach(() => {
        ApiRequest.fetchJSON.mockClear();
    });
    describe("callGroupListApi", () => {
        test("requests group list endpoint and maps response to data result", () => {
            GroupApi_1.default.callGroupListApi().engage((e) => fail(e), (groups) => {
                expect(groups).toEqual({ foo: "bar" });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("groups", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
            });
        });
    });
    describe("callGroupKeyListApi", () => {
        test("requests group list endpoint and maps response to data result", () => {
            GroupApi_1.default.callGroupKeyListApi(["group-10", "group-20"]).engage((e) => fail(e), (groups) => {
                expect(groups).toEqual({ foo: "bar" });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("groups?id=group-10%2Cgroup-20", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
            });
        });
        test("escapes IDs that are passed in", () => {
            GroupApi_1.default.callGroupKeyListApi(["~`!@#$%^&*()-_=+[{]};:<.>/?", "&<>"]).engage((e) => fail(e), (groups) => {
                expect(groups).toEqual({ foo: "bar" });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("groups?id=~%60!%40%23%24%25%5E%26*()-_%3D%2B%5B%7B%5D%7D%3B%3A%3C.%3E%2F%3F%2C%26%3C%3E", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
            });
        });
        test("returns empty array if no group IDs provided", () => {
            GroupApi_1.default.callGroupKeyListApi([]).engage((e) => fail(e), (groups) => {
                expect(groups).toEqual({ result: [] });
                expect(ApiRequest.fetchJSON).not.toHaveBeenCalled();
            });
        });
    });
    describe("callGroupGetApi", () => {
        test("requests group get with specific ID and maps response to data result", () => {
            GroupApi_1.default.callGroupGetApi("87").engage((e) => fail(e), (group) => {
                expect(group).toEqual({ foo: "bar" });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("groups/87", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
            });
        });
    });
    describe("callGroupCreateApi", () => {
        test("combines all group content into payload and maps response to data result", () => {
            const groupPublicKey = {
                x: Buffer.from([98, 105, 133]),
                y: Buffer.from([110, 98]),
            };
            const groupEncryptedPrivateKey = TestUtils.getEncryptedSymmetricKey();
            const transformKey = TestUtils.getTransformKey();
            GroupApi_1.default.callGroupCreateApi("35", groupPublicKey, groupEncryptedPrivateKey, "group name", transformKey, false).engage((e) => fail(e), (group) => {
                expect(group).toEqual({ foo: "bar" });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("groups", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                expect(JSON.parse(request.body)).toEqual({
                    id: "35",
                    name: "group name",
                    groupPublicKey: {
                        x: "YmmF",
                        y: "bmI=",
                    },
                    admins: [
                        Object.assign(Object.assign({}, groupEncryptedPrivateKey), { user: {
                                userId: "10",
                                userMasterPublicKey: TestUtils.accountPublicBytesBase64,
                            } }),
                    ],
                    members: [
                        {
                            userId: "10",
                            userMasterPublicKey: TestUtils.accountPublicBytesBase64,
                            transformKey: {
                                ephemeralPublicKey: {
                                    x: "",
                                    y: "",
                                },
                                toPublicKey: {
                                    x: "",
                                    y: "",
                                },
                                encryptedTempKey: "",
                                hashedTempKey: "",
                                publicSigningKey: "",
                                signature: "",
                            },
                        },
                    ],
                    needsRotation: false,
                });
            });
        });
        test("doesnt send in name value if one is not provided", () => {
            const groupPublicKey = {
                x: Buffer.from([98, 105, 133]),
                y: Buffer.from([110, 98]),
            };
            const groupEncryptedPrivateKey = TestUtils.getEncryptedSymmetricKey();
            const transformKey = TestUtils.getTransformKey();
            GroupApi_1.default.callGroupCreateApi("", groupPublicKey, groupEncryptedPrivateKey, "", transformKey, true).engage((e) => fail(e), (group) => {
                expect(group).toEqual({ foo: "bar" });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("groups", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                expect(JSON.parse(request.body)).toEqual({
                    groupPublicKey: {
                        x: "YmmF",
                        y: "bmI=",
                    },
                    admins: [
                        Object.assign(Object.assign({}, groupEncryptedPrivateKey), { user: {
                                userId: "10",
                                userMasterPublicKey: TestUtils.accountPublicBytesBase64,
                            } }),
                    ],
                    members: [
                        {
                            userId: "10",
                            userMasterPublicKey: TestUtils.accountPublicBytesBase64,
                            transformKey: {
                                ephemeralPublicKey: { x: "", y: "" },
                                toPublicKey: { x: "", y: "" },
                                encryptedTempKey: "",
                                hashedTempKey: "",
                                publicSigningKey: "",
                                signature: "",
                            },
                        },
                    ],
                    needsRotation: true,
                });
            });
        });
        test("checks contents of transformKey, if undefined payload should not have transformKey key or member list", () => {
            const groupPublicKey = {
                x: Buffer.from([98, 105, 133]),
                y: Buffer.from([110, 98]),
            };
            const groupEncryptedPrivateKey = {
                encryptedMessage: "abc",
                authorizationCode: "auth",
                ephemeralPublicKey: "epub",
            };
            const transformKey = undefined;
            GroupApi_1.default.callGroupCreateApi("", groupPublicKey, groupEncryptedPrivateKey, "group name", transformKey, true).engage((e) => fail(e), (group) => {
                expect(group).toEqual({ foo: "bar" });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("groups", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                expect(JSON.parse(request.body)).toEqual({
                    name: "group name",
                    groupPublicKey: {
                        x: "YmmF",
                        y: "bmI=",
                    },
                    admins: [
                        {
                            encryptedMessage: "abc",
                            authorizationCode: "auth",
                            ephemeralPublicKey: "epub",
                            user: {
                                userId: "10",
                                userMasterPublicKey: TestUtils.accountPublicBytesBase64,
                            },
                        },
                    ],
                    needsRotation: true,
                });
            });
        });
    });
    describe("callGroupUpdateApi", () => {
        test("invokes API with expected arguments when providing a new name", () => {
            GroupApi_1.default.callGroupUpdateApi("group-ID", "new group name").engage((e) => fail(e), (group) => {
                expect(group).toEqual({ foo: "bar" });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("groups/group-ID", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                expect(JSON.parse(request.body)).toEqual({
                    name: "new group name",
                });
            });
        });
        test("invokes API with expected parameters when clearing out group name", () => {
            GroupApi_1.default.callGroupUpdateApi("group&ID", null).engage((e) => fail(e), (group) => {
                expect(group).toEqual({ foo: "bar" });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("groups/group%26ID", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(JSON.parse(request.body)).toEqual({
                    name: null,
                });
            });
        });
    });
    describe("callGroupUpdateKeyApi", () => {
        test("invokes API with group key information to update", () => {
            const groupEncryptedPrivateKey = TestUtils.getEncryptedSymmetricKey();
            const userKeys = [
                {
                    encryptedPlaintext: groupEncryptedPrivateKey,
                    id: "33",
                    publicKey: { x: "firstpublickeyx", y: "firstpublickeyy" },
                },
                {
                    encryptedPlaintext: groupEncryptedPrivateKey,
                    id: "93",
                    publicKey: { x: "secondpublickey", y: "secondpublickeyy" },
                },
            ];
            GroupApi_1.default.callGroupUpdateKeyApi("353", 335, userKeys, Buffer.from("augFactor")).engage((e) => fail(e), (res) => {
                expect(res).toEqual({ foo: "bar" });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("groups/353/keys/335", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                expect(JSON.parse(request.body)).toEqual({
                    admins: [
                        Object.assign({ user: {
                                userId: "33",
                                userMasterPublicKey: { x: "firstpublickeyx", y: "firstpublickeyy" },
                            } }, groupEncryptedPrivateKey),
                        Object.assign({ user: {
                                userId: "93",
                                userMasterPublicKey: { x: "secondpublickey", y: "secondpublickeyy" },
                            } }, groupEncryptedPrivateKey),
                    ],
                    augmentationFactor: "YXVnRmFjdG9y",
                });
            });
        });
    });
    describe("callAddAdminsApi", () => {
        test("invokes API with expected parameters", () => {
            const groupEncryptedPrivateKey = TestUtils.getEncryptedSymmetricKey();
            const userKeys = [
                {
                    encryptedPlaintext: groupEncryptedPrivateKey,
                    id: "33",
                    publicKey: { x: "firstpublickeyx", y: "firstpublickeyy" },
                },
                {
                    encryptedPlaintext: groupEncryptedPrivateKey,
                    id: "93",
                    publicKey: { x: "secondpublickey", y: "secondpublickeyy" },
                },
            ];
            GroupApi_1.default.callAddAdminsApi("22", userKeys).engage((e) => fail(e), (addResult) => {
                expect(addResult).toEqual({ foo: "bar" });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("groups/22/admins", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                expect(JSON.parse(request.body)).toEqual({
                    admins: [
                        Object.assign({ user: {
                                userId: "33",
                                userMasterPublicKey: { x: "firstpublickeyx", y: "firstpublickeyy" },
                            } }, groupEncryptedPrivateKey),
                        Object.assign({ user: {
                                userId: "93",
                                userMasterPublicKey: { x: "secondpublickey", y: "secondpublickeyy" },
                            } }, groupEncryptedPrivateKey),
                    ],
                });
            });
        });
    });
    describe("callRemoveAdminsApi", () => {
        test("invokes API with expected parameters", () => {
            const userIDs = ["31", "89", "76", "33"];
            GroupApi_1.default.callRemoveAdminsApi("22", userIDs).engage((e) => fail(e.message), (removeResult) => {
                expect(removeResult).toEqual({ foo: "bar" });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("groups/22/admins", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                expect(JSON.parse(request.body)).toEqual({
                    users: [{ userId: "31" }, { userId: "89" }, { userId: "76" }, { userId: "33" }],
                });
            });
        });
    });
    describe("callAddMembersApi", () => {
        test("maps user keys to API call", () => {
            const userKeys = [
                {
                    publicKey: { x: "firstpublickeyx", y: "firstpublickeyy" },
                    transformKey: TestUtils.getTransformKey(),
                    id: "37",
                },
                {
                    publicKey: { x: "secondpublickey", y: "secondpublickeyy" },
                    transformKey: TestUtils.getTransformKey(),
                    id: "99",
                },
            ];
            GroupApi_1.default.callAddMembersApi("31", userKeys).engage((e) => fail(e), (addResult) => {
                expect(addResult).toEqual({ foo: "bar" });
                expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("groups/31/users", jasmine.any(Number), jasmine.any(Object));
                const request = ApiRequest.fetchJSON.mock.calls[0][2];
                expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                expect(JSON.parse(request.body)).toEqual({
                    users: [
                        {
                            userId: "37",
                            userMasterPublicKey: { x: "firstpublickeyx", y: "firstpublickeyy" },
                            transformKey: {
                                ephemeralPublicKey: { x: "", y: "" },
                                toPublicKey: { x: "", y: "" },
                                encryptedTempKey: "",
                                hashedTempKey: "",
                                publicSigningKey: "",
                                signature: "",
                            },
                        },
                        {
                            userId: "99",
                            userMasterPublicKey: { x: "secondpublickey", y: "secondpublickeyy" },
                            transformKey: {
                                ephemeralPublicKey: { x: "", y: "" },
                                toPublicKey: { x: "", y: "" },
                                encryptedTempKey: "",
                                hashedTempKey: "",
                                publicSigningKey: "",
                                signature: "",
                            },
                        },
                    ],
                });
            });
        });
        describe("callRemoveMembersApi", () => {
            test("passes in list of IDs to API", () => {
                GroupApi_1.default.callRemoveMembersApi("31", ["3513", "36236"]).engage((e) => fail(e), (removeResult) => {
                    expect(removeResult).toEqual({ foo: "bar" });
                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("groups/31/users", jasmine.any(Number), jasmine.any(Object));
                    const request = ApiRequest.fetchJSON.mock.calls[0][2];
                    expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                    expect(JSON.parse(request.body)).toEqual({
                        users: [{ userId: "3513" }, { userId: "36236" }],
                    });
                });
            });
        });
        describe("callGroupDeleteApi", () => {
            test("requests expected endpoint", () => {
                GroupApi_1.default.callGroupDeleteApi("31&32").engage((e) => fail(e), (deleteResult) => {
                    expect(deleteResult).toEqual({ foo: "bar" });
                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("groups/31%2632", jasmine.any(Number), jasmine.any(Object));
                    const request = ApiRequest.fetchJSON.mock.calls[0][2];
                    expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                    expect(request.body).toBeUndefined();
                });
            });
        });
    });
});
