"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const GroupApi_1 = require("../../api/GroupApi");
const UserApi_1 = require("../../api/UserApi");
const Constants_1 = require("../../Constants");
const ApiState_1 = require("../../lib/ApiState");
const TestUtils = require("../../tests/TestUtils");
const GroupCrypto = require("../GroupCrypto");
const GroupOperations = require("../GroupOperations");
describe("GroupOperations", () => {
    beforeEach(() => {
        ApiState_1.default.setAccountContext(...TestUtils.getTestApiState());
    });
    describe("list", () => {
        test("requests group list from API and maps over result", () => {
            const group = jest.spyOn(GroupApi_1.default, "callGroupListApi");
            group.mockReturnValue(futurejs_1.default.of({
                result: [
                    {
                        foo: "bar",
                        name: "group name",
                        id: "3",
                        permissions: ["admin"],
                        created: "1",
                        updated: "2",
                    },
                    {
                        foo: "bar",
                        name: null,
                        id: "87",
                        permissions: ["member", "admin"],
                        created: "3",
                        updated: "4",
                    },
                ],
            }));
            GroupOperations.list().engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    result: [
                        {
                            groupID: "3",
                            groupName: "group name",
                            isAdmin: true,
                            isMember: false,
                            created: "1",
                            updated: "2",
                        },
                        {
                            groupID: "87",
                            groupName: null,
                            isAdmin: true,
                            isMember: true,
                            created: "3",
                            updated: "4",
                        },
                    ],
                });
                expect(GroupApi_1.default.callGroupListApi).toHaveBeenCalledWith();
            });
        });
    });
    describe("get", () => {
        test("requests get endpoint for specific ID and maps response", () => {
            const groupGet = jest.spyOn(GroupApi_1.default, "callGroupGetApi");
            groupGet.mockReturnValue(futurejs_1.default.of({
                groupPublicKey: "bar",
                name: "private group",
                id: "87",
                adminIds: ["2"],
                memberIds: ["2", "53"],
                permissions: ["member", "admin"],
                created: "1",
                updated: "2",
                needsRotation: false,
            }));
            GroupOperations.get("87").engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    groupID: "87",
                    groupName: "private group",
                    groupAdmins: ["2"],
                    groupMembers: ["2", "53"],
                    isAdmin: true,
                    isMember: true,
                    created: "1",
                    updated: "2",
                });
                expect(GroupApi_1.default.callGroupGetApi).toHaveBeenCalledWith("87");
            });
        });
        test("returns partial response if only meta info is returned", () => {
            const groupGet = jest.spyOn(GroupApi_1.default, "callGroupGetApi");
            groupGet.mockReturnValue(futurejs_1.default.of({
                groupPublicKey: "bar",
                name: "private group",
                id: "87",
                permissions: [],
                created: "1",
                updated: "2",
            }));
            GroupOperations.get("87").engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    groupID: "87",
                    groupName: "private group",
                    isAdmin: false,
                    isMember: false,
                    created: "1",
                    updated: "2",
                });
                expect(GroupApi_1.default.callGroupGetApi).toHaveBeenCalledWith("87");
            });
        });
        test("returns full group response with rotation if user is admin", () => {
            const groupGet = jest.spyOn(GroupApi_1.default, "callGroupGetApi");
            groupGet.mockReturnValue(futurejs_1.default.of({
                groupPublicKey: "bar",
                name: "private group",
                encryptedPrivateKey: "aaa=",
                id: "87",
                adminIds: ["2"],
                memberIds: ["2", "53"],
                permissions: ["member", "admin"],
                created: "1",
                updated: "2",
                needsRotation: true,
            }));
            GroupOperations.get("87").engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    groupID: "87",
                    groupName: "private group",
                    groupAdmins: ["2"],
                    groupMembers: ["2", "53"],
                    isAdmin: true,
                    isMember: true,
                    created: "1",
                    updated: "2",
                    needsRotation: true,
                });
                expect(GroupApi_1.default.callGroupGetApi).toHaveBeenCalledWith("87");
            });
        });
    });
    describe("create", () => {
        test("requests create endpoint with ID and options and maps response, if addAsMemeber is set to false, transform key will return undefined", () => {
            const groupCreate = jest.spyOn(GroupApi_1.default, "callGroupCreateApi");
            groupCreate.mockReturnValue(futurejs_1.default.of({
                groupPublicKey: "bar",
                name: "private group",
                id: "87",
                adminIds: ["2"],
                memberIds: ["2", "53"],
                permissions: ["admin"],
                created: "1",
                updated: "2",
            }));
            const create = jest.spyOn(GroupCrypto, "createGroup");
            create.mockReturnValue(futurejs_1.default.of({
                encryptedGroupKey: "encGroupKey",
                groupPublicKey: "pub",
                transformKey: undefined,
            }));
            GroupOperations.create("23", "private group", false, false).engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    groupID: "87",
                    groupName: "private group",
                    groupAdmins: ["2"],
                    groupMembers: ["2", "53"],
                    isAdmin: true,
                    isMember: false,
                    created: "1",
                    updated: "2",
                });
                expect(GroupApi_1.default.callGroupCreateApi).toHaveBeenCalledWith("23", "pub", "encGroupKey", "private group", undefined, false);
                expect(GroupCrypto.createGroup).toHaveBeenCalledWith(TestUtils.accountPublicBytes, ApiState_1.default.signingKeys().privateKey, false);
            });
        });
        test("if addAsMemeber is set to true, transform key will return with a value", () => {
            const groupCreateApi = jest.spyOn(GroupApi_1.default, "callGroupCreateApi");
            groupCreateApi.mockReturnValue(futurejs_1.default.of({
                groupPublicKey: "bar",
                name: "private group",
                id: "87",
                adminIds: ["2"],
                memberIds: ["2", "53"],
                permissions: ["admin"],
                created: "1",
                updated: "2",
            }));
            const createGroup = jest.spyOn(GroupCrypto, "createGroup");
            createGroup.mockReturnValue(futurejs_1.default.of({
                encryptedGroupKey: "encGroupKey",
                groupPublicKey: "pub",
                transformKey: TestUtils.getTransformKey(),
            }));
            GroupOperations.create("", "private group", true, true).engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    groupID: "87",
                    groupName: "private group",
                    groupAdmins: ["2"],
                    groupMembers: ["2", "53"],
                    isAdmin: true,
                    isMember: false,
                    created: "1",
                    updated: "2",
                });
                expect(GroupApi_1.default.callGroupCreateApi).toHaveBeenCalledWith("", "pub", "encGroupKey", "private group", TestUtils.getTransformKey(), true);
                expect(GroupCrypto.createGroup).toHaveBeenCalledWith(TestUtils.accountPublicBytes, ApiState_1.default.signingKeys().privateKey, true);
            });
        });
    });
    describe("update", () => {
        test("calls group update endpoint and maps result", () => {
            const groupUpdateSpy = jest.spyOn(GroupApi_1.default, "callGroupUpdateApi");
            groupUpdateSpy.mockReturnValue(futurejs_1.default.of({ id: "groupID", name: "new group name", permissions: ["admin"], created: "1", updated: "2" }));
            GroupOperations.update("groupID", "new group name").engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    groupID: "groupID",
                    groupName: "new group name",
                    isAdmin: true,
                    isMember: false,
                    created: "1",
                    updated: "2",
                });
            });
        });
    });
    describe("rotateGroupPrivateKey", () => {
        test("rejects if user is not an admin of the group", () => {
            jest.spyOn(GroupApi_1.default, "callGroupGetApi").mockReturnValue(futurejs_1.default.of({
                groupPublicKey: "bar",
                name: "private group",
                id: "87",
                adminIds: ["2"],
                memberIds: ["2", "53"],
            }));
            GroupOperations.rotateGroupPrivateKey("33").engage((e) => {
                expect(e.code).toEqual(Constants_1.ErrorCodes.GROUP_ROTATE_PRIVATE_KEY_NOT_ADMIN_FAILURE);
            }, () => fail("Should not allow rotation if caller is not an admin."));
        });
        test("rotates key, updates key to API and returns result of new rotation", () => {
            jest.spyOn(GroupApi_1.default, "callGroupGetApi").mockReturnValue(futurejs_1.default.of({
                groupPublicKey: "bar",
                encryptedPrivateKey: "encGroupKey",
                name: "private group",
                id: "87",
                currentKeyId: 3352,
                adminIds: ["2", "387"],
                memberIds: ["2", "53"],
            }));
            jest.spyOn(UserApi_1.default, "callUserKeyListApi").mockReturnValue(futurejs_1.default.of({
                result: [
                    { id: "883", userMasterPublicKey: { x: "xxxx", y: "yyyy" } },
                    { id: "222", userMasterPublicKey: { x: "x2x2", y: "y2y2" } },
                ],
            }));
            jest.spyOn(GroupCrypto, "rotateGroupKey").mockReturnValue(futurejs_1.default.of({
                encryptedAccessKeys: ["encryptedAccessKey1", "encryptedAccessKey2"],
                augmentationFactor: Buffer.from([32, 97, 77]),
            }));
            jest.spyOn(GroupApi_1.default, "callGroupUpdateKeyApi").mockReturnValue(futurejs_1.default.of({
                needsRotation: false,
                id: 87,
                groupKeyId: 83,
            }));
            GroupOperations.rotateGroupPrivateKey("335").engage((e) => fail(e), (res) => {
                expect(res).toEqual({ needsRotation: false });
                expect(UserApi_1.default.callUserKeyListApi).toHaveBeenLastCalledWith(["2", "387"]);
                expect(GroupCrypto.rotateGroupKey).toHaveBeenCalledWith("encGroupKey", [
                    { id: "883", masterPublicKey: { x: "xxxx", y: "yyyy" } },
                    { id: "222", masterPublicKey: { x: "x2x2", y: "y2y2" } },
                ], TestUtils.devicePrivateBytes, expect.any(Object));
                expect(GroupApi_1.default.callGroupUpdateKeyApi).toHaveBeenCalledWith("335", 3352, ["encryptedAccessKey1", "encryptedAccessKey2"], Buffer.from([32, 97, 77]));
            });
        });
    });
    describe("addAdmins", () => {
        test("makes all expected API calls to add admins to group", () => {
            const userKeys = [
                { id: "id1", userMasterPublicKey: { x: "key1" } },
                { id: "id2", userMasterPublicKey: { x: "key2" } },
            ];
            const groupGet = jest.spyOn(GroupApi_1.default, "callGroupGetApi");
            groupGet.mockReturnValue(futurejs_1.default.of({
                groupID: "32",
                encryptedPrivateKey: "encryptedPrivKey",
                permissions: ["admin", "member"],
                adminIds: ["id1"],
            }));
            const userKeyList = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userKeyList.mockReturnValue(futurejs_1.default.of({ result: userKeys }));
            const addAdmins = jest.spyOn(GroupCrypto, "addAdminsToGroup");
            addAdmins.mockReturnValue(futurejs_1.default.of(["encryptedAccessKey1", "encryptedAccessKey2"]));
            const addAdminsApi = jest.spyOn(GroupApi_1.default, "callAddAdminsApi");
            addAdminsApi.mockReturnValue(futurejs_1.default.of({
                succeededIds: [{ userId: "user1" }, { userId: "user2" }],
                failedIds: [{ userId: "12", errorMessage: "does not exist" }],
            }));
            GroupOperations.addAdmins("33", ["user1", "user2"]).engage((e) => fail(e.message), (result) => {
                expect(result).toEqual({
                    succeeded: ["user1", "user2"],
                    failed: [{ id: "12", error: "does not exist" }],
                });
                expect(GroupApi_1.default.callGroupGetApi).toHaveBeenCalledWith("33");
                expect(UserApi_1.default.callUserKeyListApi).toHaveBeenCalledWith(["user1", "user2"]);
                expect(GroupApi_1.default.callAddAdminsApi).toHaveBeenCalledWith("33", ["encryptedAccessKey1", "encryptedAccessKey2"]);
                expect(GroupCrypto.addAdminsToGroup).toHaveBeenCalledWith("encryptedPrivKey", [
                    { id: "id1", masterPublicKey: { x: "key1" } },
                    { id: "id2", masterPublicKey: { x: "key2" } },
                ], jasmine.any(Buffer), ApiState_1.default.signingKeys().privateKey);
            });
        });
        test("returns list of failures when no users entered exist", () => {
            const groupGet = jest.spyOn(GroupApi_1.default, "callGroupGetApi");
            groupGet.mockReturnValue(futurejs_1.default.of({ groupID: "32", encryptedPrivateKey: "encryptedPrivKey", permissions: ["admin", "member"] }));
            const userKeyList = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userKeyList.mockReturnValue(futurejs_1.default.of({ result: [] }));
            jest.spyOn(GroupCrypto, "addAdminsToGroup");
            GroupOperations.addAdmins("33", ["user1", "user2"]).engage((e) => fail(e.message), (result) => {
                expect(result).toEqual({
                    succeeded: [],
                    failed: [
                        { id: "user1", error: jasmine.any(String) },
                        { id: "user2", error: jasmine.any(String) },
                    ],
                });
                expect(GroupApi_1.default.callGroupGetApi).toHaveBeenCalledWith("33");
                expect(UserApi_1.default.callUserKeyListApi).toHaveBeenCalledWith(["user1", "user2"]);
                expect(GroupCrypto.addAdminsToGroup).not.toHaveBeenCalled();
            });
        });
        test("fails if the group get response doesnt return an encrypted private key, indicating the user is not a group admin", () => {
            const groupGet = jest.spyOn(GroupApi_1.default, "callGroupGetApi");
            groupGet.mockReturnValue(futurejs_1.default.of({ groupID: "33", permissions: [] }));
            const userKeyList = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userKeyList.mockReturnValue(futurejs_1.default.of({ result: ["key1", "key2"] }));
            GroupOperations.addAdmins("33", ["user1", "user2"]).engage((e) => {
                expect(e.message).toBeString();
                expect(e.code).toBeNumber();
            }, () => fail("Should not be able to add members when user is not an admin and GET does not return an encrypted private key"));
        });
        test("fails if the group get response only says the current user is a member and not an admin", () => {
            const groupGet = jest.spyOn(GroupApi_1.default, "callGroupGetApi");
            groupGet.mockReturnValue(futurejs_1.default.of({ groupID: "61", permissions: ["user"] }));
            const userKeyList = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userKeyList.mockReturnValue(futurejs_1.default.of({ result: ["key1", "key2"] }));
            GroupOperations.addAdmins("61", ["user1", "user2"]).engage((e) => {
                expect(e.message).toBeString();
                expect(e.code).toBeNumber();
            }, () => fail("Should not be able to add members when user is not an admin and GET does not return an encrypted private key"));
        });
        test("correctly includes requested users who didnt exist in failure list", () => {
            const userKeys = [
                { id: "id1", userMasterPublicKey: { x: "key1" } },
                { id: "id2", userMasterPublicKey: { x: "key2" } },
            ];
            const groupGet = jest.spyOn(GroupApi_1.default, "callGroupGetApi");
            groupGet.mockReturnValue(futurejs_1.default.of({
                groupID: "32",
                encryptedPrivateKey: "encryptedPrivKey",
                permissions: ["admin", "member"],
                adminIds: ["id1"],
            }));
            const userKeyList = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userKeyList.mockReturnValue(futurejs_1.default.of({ result: userKeys }));
            const addAdmins = jest.spyOn(GroupCrypto, "addAdminsToGroup");
            addAdmins.mockReturnValue(futurejs_1.default.of(["encryptedAccessKey1", "encryptedAccessKey2"]));
            const addAdminsApi = jest.spyOn(GroupApi_1.default, "callAddAdminsApi");
            addAdminsApi.mockReturnValue(futurejs_1.default.of({
                succeededIds: [{ userId: "id1" }, { userId: "id2" }],
                failedIds: [{ userId: "id3", errorMessage: "does not exist" }],
            }));
            GroupOperations.addAdmins("33", ["id1", "id2", "id3", "id4"]).engage((e) => fail(e.message), (result) => {
                expect(result).toEqual({
                    succeeded: ["id1", "id2"],
                    failed: [
                        { id: "id3", error: "does not exist" },
                        { id: "id4", error: "ID did not exist in the system." },
                    ],
                });
            });
        });
    });
    describe("removeAdmins", () => {
        test("invokes group admin remove API and maps result correctly", () => {
            const removeAdminsApi = jest.spyOn(GroupApi_1.default, "callRemoveAdminsApi");
            removeAdminsApi.mockReturnValue(futurejs_1.default.of({
                succeededIds: [{ userId: "88" }, { userId: "13" }],
                failedIds: [
                    { userId: "12", errorMessage: "does not exist" },
                    { userId: "33", errorMessage: "is group creator" },
                ],
            }));
            GroupOperations.removeAdmins("3235", ["88", "13", "12", "33"]).engage((e) => fail(e.message), (result) => {
                expect(result).toEqual({
                    succeeded: ["88", "13"],
                    failed: [
                        { id: "12", error: "does not exist" },
                        { id: "33", error: "is group creator" },
                    ],
                });
            });
        });
        test("includes list of users in failures if the arent included in response", () => {
            const removeAdminsApi = jest.spyOn(GroupApi_1.default, "callRemoveAdminsApi");
            removeAdminsApi.mockReturnValue(futurejs_1.default.of({
                succeededIds: [{ userId: "88" }],
                failedIds: [
                    { userId: "12", errorMessage: "does not exist" },
                    { userId: "33", errorMessage: "is group creator" },
                ],
            }));
            GroupOperations.removeAdmins("3235", ["88", "13", "12", "33"]).engage((e) => fail(e.message), (result) => {
                expect(result).toEqual({
                    succeeded: ["88"],
                    failed: [
                        { id: "12", error: "does not exist" },
                        { id: "33", error: "is group creator" },
                        { id: "13", error: "ID did not exist in the system." },
                    ],
                });
            });
        });
    });
    describe("addMembers", () => {
        test("makes all expected API calls to add members to group", (done) => {
            const userKeys = [
                { id: "id1", userMasterPublicKey: { x: "key1" } },
                { id: "id2", userMasterPublicKey: { x: "key2" } },
            ];
            const groupGet = jest.spyOn(GroupApi_1.default, "callGroupGetApi");
            groupGet.mockReturnValue(futurejs_1.default.of({
                groupID: "32",
                encryptedPrivateKey: "encryptedPrivKey",
                permissions: ["admin", "member"],
                adminIds: ["id1"],
            }));
            const userKeyList = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userKeyList.mockReturnValue(futurejs_1.default.of({ result: userKeys }));
            const addMembersApi = jest.spyOn(GroupApi_1.default, "callAddMembersApi");
            addMembersApi.mockReturnValue(futurejs_1.default.of({
                succeededIds: [{ userId: "user1" }, { userId: "user2" }],
                failedIds: [{ userId: "12", errorMessage: "does not exist" }],
            }));
            const addMembers = jest.spyOn(GroupCrypto, "addMembersToGroup");
            addMembers.mockReturnValue(futurejs_1.default.of(["transformKey1", "transformKey2"]));
            GroupOperations.addMembers("61", ["user1", "user2"]).engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    succeeded: ["user1", "user2"],
                    failed: [{ id: "12", error: "does not exist" }],
                });
                expect(GroupApi_1.default.callGroupGetApi).toHaveBeenCalledWith("61");
                expect(UserApi_1.default.callUserKeyListApi).toHaveBeenCalledWith(["user1", "user2"]);
                expect(GroupApi_1.default.callAddMembersApi).toHaveBeenCalledWith("61", ["transformKey1", "transformKey2"]);
                expect(GroupCrypto.addMembersToGroup).toHaveBeenCalledWith("encryptedPrivKey", [
                    { id: "id1", masterPublicKey: { x: "key1" } },
                    { id: "id2", masterPublicKey: { x: "key2" } },
                ], jasmine.any(Buffer), ApiState_1.default.signingKeys().privateKey);
                done();
            });
        });
        test("fails fast if none of the requested members exist", (done) => {
            const groupGet = jest.spyOn(GroupApi_1.default, "callGroupGetApi");
            groupGet.mockReturnValue(futurejs_1.default.of({ groupID: "32", encryptedPrivateKey: "encryptedPrivKey", permissions: ["admin", "member"] }));
            const userKeyList = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userKeyList.mockReturnValue(futurejs_1.default.of({ result: [] }));
            jest.spyOn(GroupCrypto, "addMembersToGroup");
            GroupOperations.addMembers("61", ["user1", "user2"]).engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    succeeded: [],
                    failed: [
                        { id: "user1", error: jasmine.any(String) },
                        { id: "user2", error: jasmine.any(String) },
                    ],
                });
                expect(GroupApi_1.default.callGroupGetApi).toHaveBeenCalledWith("61");
                expect(UserApi_1.default.callUserKeyListApi).toHaveBeenCalledWith(["user1", "user2"]);
                expect(GroupCrypto.addMembersToGroup).not.toHaveBeenCalled();
                done();
            });
        });
        test("fails if the group get response doesnt return an encrypted private key, indicating the user is not a group admin", () => {
            const groupGet = jest.spyOn(GroupApi_1.default, "callGroupGetApi");
            groupGet.mockReturnValue(futurejs_1.default.of({ groupID: "32", permissions: [] }));
            const userKeyList = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userKeyList.mockReturnValue(futurejs_1.default.of({ result: ["key1", "key2"] }));
            GroupOperations.addMembers("61", ["user1", "user2"]).engage((e) => {
                expect(e.message).toBeString();
                expect(e.code).toBeNumber();
            }, () => fail("Should not be able to add members when user is not an admin and GET does not return an encrypted private key"));
        });
        test("fails if the group get response only indicates that the user is a member and not an admin", () => {
            const groupGet = jest.spyOn(GroupApi_1.default, "callGroupGetApi");
            groupGet.mockReturnValue(futurejs_1.default.of({ groupID: "32", permissions: ["user"] }));
            const userKeyList = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userKeyList.mockReturnValue(futurejs_1.default.of({ result: ["key1", "key2"] }));
            GroupOperations.addMembers("61", ["user1", "user2"]).engage((e) => {
                expect(e.message).toBeString();
                expect(e.code).toBeNumber();
            }, () => fail("Should not be able to add members when user is not an admin and GET does not return an encrypted private key"));
        });
        test("includes users who were requested but didnt exist in failure list", () => {
            const userKeys = [
                { id: "id1", userMasterPublicKey: { x: "key1" } },
                { id: "id2", userMasterPublicKey: { x: "key2" } },
            ];
            const groupGet = jest.spyOn(GroupApi_1.default, "callGroupGetApi");
            groupGet.mockReturnValue(futurejs_1.default.of({
                groupID: "32",
                encryptedPrivateKey: "encryptedPrivKey",
                permissions: ["admin", "member"],
                adminIds: ["id1"],
            }));
            const userKeyList = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userKeyList.mockReturnValue(futurejs_1.default.of({ result: userKeys }));
            const addMembersApi = jest.spyOn(GroupApi_1.default, "callAddMembersApi");
            addMembersApi.mockReturnValue(futurejs_1.default.of({
                succeededIds: [{ userId: "user1" }],
                failedIds: [{ userId: "12", errorMessage: "does not exist" }],
            }));
            const addMembers = jest.spyOn(GroupCrypto, "addMembersToGroup");
            addMembers.mockReturnValue(futurejs_1.default.of(["transformKey1", "transformKey2"]));
            GroupOperations.addMembers("61", ["user1", "user2", "12"]).engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    succeeded: ["user1"],
                    failed: [
                        { id: "12", error: "does not exist" },
                        { id: "user2", error: "ID did not exist in the system." },
                    ],
                });
            });
        });
    });
    describe("removeMembers", () => {
        test("invokes API with list and maps result correctly", (done) => {
            const removeMembersApi = jest.spyOn(GroupApi_1.default, "callRemoveMembersApi");
            removeMembersApi.mockReturnValue(futurejs_1.default.of({
                succeededIds: [{ userId: "user1" }, { userId: "user2" }],
                failedIds: [{ userId: "12", errorMessage: "does not exist" }],
            }));
            GroupOperations.removeMembers("61", ["user1", "user2"]).engage((e) => fail(e), (result) => {
                expect(result).toEqual({
                    succeeded: ["user1", "user2"],
                    failed: [{ id: "12", error: "does not exist" }],
                });
                expect(GroupApi_1.default.callRemoveMembersApi).toHaveBeenCalledWith("61", ["user1", "user2"]);
                done();
            });
        });
        test("includes list of users in failures if the arent included in response", () => {
            const removeMembersApi = jest.spyOn(GroupApi_1.default, "callRemoveMembersApi");
            removeMembersApi.mockReturnValue(futurejs_1.default.of({
                succeededIds: [{ userId: "88" }],
                failedIds: [
                    { userId: "12", errorMessage: "does not exist" },
                    { userId: "33", errorMessage: "is group creator" },
                ],
            }));
            GroupOperations.removeMembers("3235", ["88", "13", "12", "33"]).engage((e) => fail(e.message), (result) => {
                expect(result).toEqual({
                    succeeded: ["88"],
                    failed: [
                        { id: "12", error: "does not exist" },
                        { id: "33", error: "is group creator" },
                        { id: "13", error: "ID did not exist in the system." },
                    ],
                });
            });
        });
    });
    describe("deleteGroup", () => {
        test("invokes group delete endpoint", () => {
            const deleteApi = jest.spyOn(GroupApi_1.default, "callGroupDeleteApi");
            deleteApi.mockReturnValue(futurejs_1.default.of("delete result"));
            GroupOperations.deleteGroup("3235").engage((e) => fail(e.message), (result) => {
                expect(result).toEqual("delete result");
            });
        });
    });
});
