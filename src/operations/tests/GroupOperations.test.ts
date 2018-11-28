import Future from "futurejs";
import * as GroupOperations from "../GroupOperations";
import * as GroupCrypto from "../GroupCrypto";
import GroupApi from "../../api/GroupApi";
import UserApi from "../../api/UserApi";
import * as TestUtils from "../../tests/TestUtils";
import ApiState from "../../lib/ApiState";

describe("GroupOperations", () => {
    beforeEach(() => {
        ApiState.setAccountContext(
            TestUtils.testAccountID,
            TestUtils.testSegmentID,
            TestUtils.accountPublicBytes,
            TestUtils.devicePrivateBytes,
            TestUtils.signingPrivateBytes
        );
    });

    describe("list", () => {
        test("requests group list from API and maps over result", () => {
            const group = jest.spyOn(GroupApi, "callGroupListApi");
            group.mockReturnValue(
                Future.of({
                    result: [
                        {
                            foo: "bar",
                            name: "group name",
                            id: "3",
                            permissions: ["admin"],
                        },
                        {
                            foo: "bar",
                            name: null,
                            id: "87",
                            permissions: ["member", "admin"],
                        },
                    ],
                })
            );

            GroupOperations.list().engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toEqual({
                        result: [
                            {
                                groupID: "3",
                                groupName: "group name",
                                isAdmin: true,
                                isMember: false,
                            },
                            {
                                groupID: "87",
                                groupName: null,
                                isAdmin: true,
                                isMember: true,
                            },
                        ],
                    });

                    expect(GroupApi.callGroupListApi).toHaveBeenCalledWith();
                }
            );
        });
    });

    describe("get", () => {
        test("requests get endpoint for specific ID and maps response", () => {
            const groupGet = jest.spyOn(GroupApi, "callGroupGetApi");
            groupGet.mockReturnValue(
                Future.of({
                    groupPublicKey: "bar",
                    name: "private group",
                    id: "87",
                    adminIds: ["2"],
                    memberIds: ["2", "53"],
                    permissions: ["member", "admin"],
                })
            );

            GroupOperations.get("87").engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toEqual({
                        groupID: "87",
                        groupName: "private group",
                        groupAdmins: ["2"],
                        groupMembers: ["2", "53"],
                        isAdmin: true,
                        isMember: true,
                    });

                    expect(GroupApi.callGroupGetApi).toHaveBeenCalledWith("87");
                }
            );
        });

        test("returns partial response if only meta info is returned", () => {
            const groupGet = jest.spyOn(GroupApi, "callGroupGetApi");
            groupGet.mockReturnValue(
                Future.of({
                    groupPublicKey: "bar",
                    name: "private group",
                    id: "87",
                    permissions: [],
                })
            );

            GroupOperations.get("87").engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toEqual({
                        groupID: "87",
                        groupName: "private group",
                        isAdmin: false,
                        isMember: false,
                    });

                    expect(GroupApi.callGroupGetApi).toHaveBeenCalledWith("87");
                }
            );
        });
    });

    describe("create", () => {
        test("requests create endpoint with ID and options and maps response, if addAsMemeber is set to false, transform key will return undefined", () => {
            const groupCreate = jest.spyOn(GroupApi, "callGroupCreateApi");
            groupCreate.mockReturnValue(
                Future.of({
                    groupPublicKey: "bar",
                    name: "private group",
                    id: "87",
                    adminIds: ["2"],
                    memberIds: ["2", "53"],
                    permissions: ["admin"],
                })
            );

            const create = jest.spyOn(GroupCrypto, "createGroup");
            create.mockReturnValue(
                Future.of({
                    encryptedGroupKey: "encGroupKey",
                    groupPublicKey: "pub",
                    transformKey: undefined,
                })
            );

            GroupOperations.create("23", "private group", false).engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toEqual({
                        groupID: "87",
                        groupName: "private group",
                        groupAdmins: ["2"],
                        groupMembers: ["2", "53"],
                        isAdmin: true,
                        isMember: false,
                    });

                    expect(GroupApi.callGroupCreateApi).toHaveBeenCalledWith("23", "pub", "encGroupKey", "private group", undefined);
                    expect(GroupCrypto.createGroup).toHaveBeenCalledWith(TestUtils.accountPublicBytes, ApiState.signingKeys().privateKey, false);
                }
            );
        });

        test("if addAsMemeber is set to true, transform key will return with a value", () => {
            const groupCreateApi = jest.spyOn(GroupApi, "callGroupCreateApi");
            groupCreateApi.mockReturnValue(
                Future.of({
                    groupPublicKey: "bar",
                    name: "private group",
                    id: "87",
                    adminIds: ["2"],
                    memberIds: ["2", "53"],
                    permissions: ["admin"],
                })
            );

            const createGroup = jest.spyOn(GroupCrypto, "createGroup");
            createGroup.mockReturnValue(
                Future.of({
                    encryptedGroupKey: "encGroupKey",
                    groupPublicKey: "pub",
                    transformKey: TestUtils.getTransformKey(),
                })
            );

            GroupOperations.create("", "private group", true).engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toEqual({
                        groupID: "87",
                        groupName: "private group",
                        groupAdmins: ["2"],
                        groupMembers: ["2", "53"],
                        isAdmin: true,
                        isMember: false,
                    });

                    expect(GroupApi.callGroupCreateApi).toHaveBeenCalledWith("", "pub", "encGroupKey", "private group", TestUtils.getTransformKey());
                    expect(GroupCrypto.createGroup).toHaveBeenCalledWith(TestUtils.accountPublicBytes, ApiState.signingKeys().privateKey, true);
                }
            );
        });
    });

    describe("update", () => {
        test("calls group update endpoint and maps result", () => {
            const groupUpdateSpy = jest.spyOn(GroupApi, "callGroupUpdateApi");
            groupUpdateSpy.mockReturnValue(Future.of({id: "groupID", name: "new group name", permissions: ["admin"]}));

            GroupOperations.update("groupID", "new group name").engage(
                (e) => fail(e),
                (result) => {
                    expect(result).toEqual({
                        groupID: "groupID",
                        groupName: "new group name",
                        isAdmin: true,
                        isMember: false,
                    });
                }
            );
        });
    });

    describe("addAdmins", () => {
        test("makes all expected API calls to add admins to group", () => {
            const userKeys = [{id: "id1", userMasterPublicKey: {x: "key1"}}, {id: "id2", userMasterPublicKey: {x: "key2"}}];

            const groupGet = jest.spyOn(GroupApi, "callGroupGetApi");
            groupGet.mockReturnValue(Future.of({groupID: "32", encryptedPrivateKey: "encryptedPrivKey", permissions: ["admin", "member"], adminIds: ["id1"]}));
            const userKeyList = jest.spyOn(UserApi, "callUserKeyListApi");
            userKeyList.mockReturnValue(Future.of({result: userKeys}));
            const addAdmins = jest.spyOn(GroupCrypto, "addAdminsToGroup");
            addAdmins.mockReturnValue(Future.of(["encryptedAccessKey1", "encryptedAccessKey2"]));
            const addAdminsApi = jest.spyOn(GroupApi, "callAddAdminsApi");
            addAdminsApi.mockReturnValue(
                Future.of({
                    succeededIds: [{userId: "user1"}, {userId: "user2"}],
                    failedIds: [{userId: "12", errorMessage: "does not exist"}],
                })
            );

            GroupOperations.addAdmins("33", ["user1", "user2"]).engage(
                (e) => fail(e.message),
                (result) => {
                    expect(result).toEqual({
                        succeeded: ["user1", "user2"],
                        failed: [{id: "12", error: "does not exist"}],
                    });

                    expect(GroupApi.callGroupGetApi).toHaveBeenCalledWith("33");
                    expect(UserApi.callUserKeyListApi).toHaveBeenCalledWith(["user1", "user2"]);
                    expect(GroupApi.callAddAdminsApi).toHaveBeenCalledWith("33", ["encryptedAccessKey1", "encryptedAccessKey2"]);
                    expect(GroupCrypto.addAdminsToGroup).toHaveBeenCalledWith(
                        "encryptedPrivKey",
                        [{id: "id1", masterPublicKey: {x: "key1"}}, {id: "id2", masterPublicKey: {x: "key2"}}],
                        jasmine.any(Buffer),
                        ApiState.signingKeys().privateKey
                    );
                }
            );
        });

        test("returns list of failures when no users entered exist", () => {
            const groupGet = jest.spyOn(GroupApi, "callGroupGetApi");
            groupGet.mockReturnValue(Future.of({groupID: "32", encryptedPrivateKey: "encryptedPrivKey", permissions: ["admin", "member"]}));
            const userKeyList = jest.spyOn(UserApi, "callUserKeyListApi");
            userKeyList.mockReturnValue(Future.of({result: []}));
            jest.spyOn(GroupCrypto, "addAdminsToGroup");

            GroupOperations.addAdmins("33", ["user1", "user2"]).engage(
                (e) => fail(e.message),
                (result: any) => {
                    expect(result).toEqual({
                        succeeded: [],
                        failed: [{id: "user1", error: jasmine.any(String)}, {id: "user2", error: jasmine.any(String)}],
                    });

                    expect(GroupApi.callGroupGetApi).toHaveBeenCalledWith("33");
                    expect(UserApi.callUserKeyListApi).toHaveBeenCalledWith(["user1", "user2"]);
                    expect(GroupCrypto.addAdminsToGroup).not.toHaveBeenCalled();
                }
            );
        });

        test("fails if the group get response doesnt return an encrypted private key, indicating the user is not a group admin", () => {
            const groupGet = jest.spyOn(GroupApi, "callGroupGetApi");
            groupGet.mockReturnValue(Future.of({groupID: "33", permissions: []}));
            const userKeyList = jest.spyOn(UserApi, "callUserKeyListApi");
            userKeyList.mockReturnValue(Future.of({result: ["key1", "key2"]}));

            GroupOperations.addAdmins("33", ["user1", "user2"]).engage(
                (e) => {
                    expect(e.message).toBeString();
                    expect(e.code).toBeNumber();
                },
                () => fail("Should not be able to add members when user is not an admin and GET does not return an encrypted private key")
            );
        });

        test("fails if the group get response only says the current user is a member and not an admin", () => {
            const groupGet = jest.spyOn(GroupApi, "callGroupGetApi");
            groupGet.mockReturnValue(Future.of({groupID: "61", permissions: ["user"]}));
            const userKeyList = jest.spyOn(UserApi, "callUserKeyListApi");
            userKeyList.mockReturnValue(Future.of({result: ["key1", "key2"]}));

            GroupOperations.addAdmins("61", ["user1", "user2"]).engage(
                (e) => {
                    expect(e.message).toBeString();
                    expect(e.code).toBeNumber();
                },
                () => fail("Should not be able to add members when user is not an admin and GET does not return an encrypted private key")
            );
        });

        test("correctly includes requested users who didnt exist in failure list", () => {
            const userKeys = [{id: "id1", userMasterPublicKey: {x: "key1"}}, {id: "id2", userMasterPublicKey: {x: "key2"}}];

            const groupGet = jest.spyOn(GroupApi, "callGroupGetApi");
            groupGet.mockReturnValue(Future.of({groupID: "32", encryptedPrivateKey: "encryptedPrivKey", permissions: ["admin", "member"], adminIds: ["id1"]}));
            const userKeyList = jest.spyOn(UserApi, "callUserKeyListApi");
            userKeyList.mockReturnValue(Future.of({result: userKeys}));
            const addAdmins = jest.spyOn(GroupCrypto, "addAdminsToGroup");
            addAdmins.mockReturnValue(Future.of(["encryptedAccessKey1", "encryptedAccessKey2"]));
            const addAdminsApi = jest.spyOn(GroupApi, "callAddAdminsApi");
            addAdminsApi.mockReturnValue(
                Future.of({
                    succeededIds: [{userId: "id1"}, {userId: "id2"}],
                    failedIds: [{userId: "id3", errorMessage: "does not exist"}],
                })
            );

            GroupOperations.addAdmins("33", ["id1", "id2", "id3", "id4"]).engage(
                (e) => fail(e.message),
                (result) => {
                    expect(result).toEqual({
                        succeeded: ["id1", "id2"],
                        failed: [{id: "id3", error: "does not exist"}, {id: "id4", error: "ID did not exist in the system."}],
                    });
                }
            );
        });
    });

    describe("removeAdmins", () => {
        test("invokes group admin remove API and maps result correctly", () => {
            const removeAdminsApi = jest.spyOn(GroupApi, "callRemoveAdminsApi");
            removeAdminsApi.mockReturnValue(
                Future.of({
                    succeededIds: [{userId: "88"}, {userId: "13"}],
                    failedIds: [{userId: "12", errorMessage: "does not exist"}, {userId: "33", errorMessage: "is group creator"}],
                })
            );

            GroupOperations.removeAdmins("3235", ["88", "13", "12", "33"]).engage(
                (e) => fail(e.message),
                (result) => {
                    expect(result).toEqual({
                        succeeded: ["88", "13"],
                        failed: [{id: "12", error: "does not exist"}, {id: "33", error: "is group creator"}],
                    });
                }
            );
        });

        test("includes list of users in failures if the arent included in response", () => {
            const removeAdminsApi = jest.spyOn(GroupApi, "callRemoveAdminsApi");
            removeAdminsApi.mockReturnValue(
                Future.of({
                    succeededIds: [{userId: "88"}],
                    failedIds: [{userId: "12", errorMessage: "does not exist"}, {userId: "33", errorMessage: "is group creator"}],
                })
            );

            GroupOperations.removeAdmins("3235", ["88", "13", "12", "33"]).engage(
                (e) => fail(e.message),
                (result) => {
                    expect(result).toEqual({
                        succeeded: ["88"],
                        failed: [
                            {id: "12", error: "does not exist"},
                            {id: "33", error: "is group creator"},
                            {id: "13", error: "ID did not exist in the system."},
                        ],
                    });
                }
            );
        });
    });

    describe("addMembers", () => {
        test("makes all expected API calls to add members to group", (done) => {
            const userKeys = [{id: "id1", userMasterPublicKey: {x: "key1"}}, {id: "id2", userMasterPublicKey: {x: "key2"}}];

            const groupGet = jest.spyOn(GroupApi, "callGroupGetApi");
            groupGet.mockReturnValue(Future.of({groupID: "32", encryptedPrivateKey: "encryptedPrivKey", permissions: ["admin", "member"], adminIds: ["id1"]}));
            const userKeyList = jest.spyOn(UserApi, "callUserKeyListApi");
            userKeyList.mockReturnValue(Future.of({result: userKeys}));
            const addMembersApi = jest.spyOn(GroupApi, "callAddMembersApi");
            addMembersApi.mockReturnValue(
                Future.of({
                    succeededIds: [{userId: "user1"}, {userId: "user2"}],
                    failedIds: [{userId: "12", errorMessage: "does not exist"}],
                })
            );
            const addMembers = jest.spyOn(GroupCrypto, "addMembersToGroup");
            addMembers.mockReturnValue(Future.of(["transformKey1", "transformKey2"]));

            GroupOperations.addMembers("61", ["user1", "user2"]).engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toEqual({
                        succeeded: ["user1", "user2"],
                        failed: [{id: "12", error: "does not exist"}],
                    });

                    expect(GroupApi.callGroupGetApi).toHaveBeenCalledWith("61");
                    expect(UserApi.callUserKeyListApi).toHaveBeenCalledWith(["user1", "user2"]);
                    expect(GroupApi.callAddMembersApi).toHaveBeenCalledWith("61", ["transformKey1", "transformKey2"]);
                    expect(GroupCrypto.addMembersToGroup).toHaveBeenCalledWith(
                        "encryptedPrivKey",
                        [{id: "id1", masterPublicKey: {x: "key1"}}, {id: "id2", masterPublicKey: {x: "key2"}}],
                        jasmine.any(Buffer),
                        ApiState.signingKeys().privateKey
                    );

                    done();
                }
            );
        });

        test("fails fast if none of the requested members exist", (done) => {
            const groupGet = jest.spyOn(GroupApi, "callGroupGetApi");
            groupGet.mockReturnValue(Future.of({groupID: "32", encryptedPrivateKey: "encryptedPrivKey", permissions: ["admin", "member"]}));
            const userKeyList = jest.spyOn(UserApi, "callUserKeyListApi");
            userKeyList.mockReturnValue(Future.of({result: []}));
            jest.spyOn(GroupCrypto, "addMembersToGroup");

            GroupOperations.addMembers("61", ["user1", "user2"]).engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toEqual({
                        succeeded: [],
                        failed: [{id: "user1", error: jasmine.any(String)}, {id: "user2", error: jasmine.any(String)}],
                    });

                    expect(GroupApi.callGroupGetApi).toHaveBeenCalledWith("61");
                    expect(UserApi.callUserKeyListApi).toHaveBeenCalledWith(["user1", "user2"]);
                    expect(GroupCrypto.addMembersToGroup).not.toHaveBeenCalled();
                    done();
                }
            );
        });

        test("fails if the group get response doesnt return an encrypted private key, indicating the user is not a group admin", () => {
            const groupGet = jest.spyOn(GroupApi, "callGroupGetApi");
            groupGet.mockReturnValue(Future.of({groupID: "32", permissions: []}));
            const userKeyList = jest.spyOn(UserApi, "callUserKeyListApi");
            userKeyList.mockReturnValue(Future.of({result: ["key1", "key2"]}));

            GroupOperations.addMembers("61", ["user1", "user2"]).engage(
                (e) => {
                    expect(e.message).toBeString();
                    expect(e.code).toBeNumber();
                },
                () => fail("Should not be able to add members when user is not an admin and GET does not return an encrypted private key")
            );
        });

        test("fails if the group get response only indicates that the user is a member and not an admin", () => {
            const groupGet = jest.spyOn(GroupApi, "callGroupGetApi");
            groupGet.mockReturnValue(Future.of({groupID: "32", permissions: ["user"]}));
            const userKeyList = jest.spyOn(UserApi, "callUserKeyListApi");
            userKeyList.mockReturnValue(Future.of({result: ["key1", "key2"]}));

            GroupOperations.addMembers("61", ["user1", "user2"]).engage(
                (e) => {
                    expect(e.message).toBeString();
                    expect(e.code).toBeNumber();
                },
                () => fail("Should not be able to add members when user is not an admin and GET does not return an encrypted private key")
            );
        });

        test("includes users who were requested but didnt exist in failure list", () => {
            const userKeys = [{id: "id1", userMasterPublicKey: {x: "key1"}}, {id: "id2", userMasterPublicKey: {x: "key2"}}];

            const groupGet = jest.spyOn(GroupApi, "callGroupGetApi");
            groupGet.mockReturnValue(Future.of({groupID: "32", encryptedPrivateKey: "encryptedPrivKey", permissions: ["admin", "member"], adminIds: ["id1"]}));
            const userKeyList = jest.spyOn(UserApi, "callUserKeyListApi");
            userKeyList.mockReturnValue(Future.of({result: userKeys}));
            const addMembersApi = jest.spyOn(GroupApi, "callAddMembersApi");
            addMembersApi.mockReturnValue(
                Future.of({
                    succeededIds: [{userId: "user1"}],
                    failedIds: [{userId: "12", errorMessage: "does not exist"}],
                })
            );
            const addMembers = jest.spyOn(GroupCrypto, "addMembersToGroup");
            addMembers.mockReturnValue(Future.of(["transformKey1", "transformKey2"]));

            GroupOperations.addMembers("61", ["user1", "user2", "12"]).engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toEqual({
                        succeeded: ["user1"],
                        failed: [{id: "12", error: "does not exist"}, {id: "user2", error: "ID did not exist in the system."}],
                    });
                }
            );
        });
    });

    describe("removeMembers", () => {
        test("invokes API with list and maps result correctly", (done) => {
            const removeMembersApi = jest.spyOn(GroupApi, "callRemoveMembersApi");
            removeMembersApi.mockReturnValue(
                Future.of({
                    succeededIds: [{userId: "user1"}, {userId: "user2"}],
                    failedIds: [{userId: "12", errorMessage: "does not exist"}],
                })
            );

            GroupOperations.removeMembers("61", ["user1", "user2"]).engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toEqual({
                        succeeded: ["user1", "user2"],
                        failed: [{id: "12", error: "does not exist"}],
                    });

                    expect(GroupApi.callRemoveMembersApi).toHaveBeenCalledWith("61", ["user1", "user2"]);
                    done();
                }
            );
        });

        test("includes list of users in failures if the arent included in response", () => {
            const removeMembersApi = jest.spyOn(GroupApi, "callRemoveMembersApi");
            removeMembersApi.mockReturnValue(
                Future.of({
                    succeededIds: [{userId: "88"}],
                    failedIds: [{userId: "12", errorMessage: "does not exist"}, {userId: "33", errorMessage: "is group creator"}],
                })
            );

            GroupOperations.removeMembers("3235", ["88", "13", "12", "33"]).engage(
                (e) => fail(e.message),
                (result) => {
                    expect(result).toEqual({
                        succeeded: ["88"],
                        failed: [
                            {id: "12", error: "does not exist"},
                            {id: "33", error: "is group creator"},
                            {id: "13", error: "ID did not exist in the system."},
                        ],
                    });
                }
            );
        });
    });
});
