"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const GroupOperations = require("../../operations/GroupOperations");
const GroupSDK = require("../GroupSDK");
describe("GroupSDK", () => {
    describe("list", () => {
        test("calls list operation", (done) => {
            const spy = jest.spyOn(GroupOperations, "list");
            spy.mockReturnValue(futurejs_1.default.of("list"));
            GroupSDK.list()
                .then((result) => {
                expect(result).toEqual("list");
                expect(GroupOperations.list).toHaveBeenCalledWith();
                done();
            })
                .catch((e) => fail(e));
        });
    });
    describe("get", () => {
        test("fails when group ID is invalid", () => {
            expect(() => GroupSDK.get(8)).toThrow();
            expect(() => GroupSDK.get("")).toThrow();
            expect(() => GroupSDK.get("`ID")).toThrow();
        });
        test("calls group get operation", (done) => {
            const spy = jest.spyOn(GroupOperations, "get");
            spy.mockReturnValue(futurejs_1.default.of("get"));
            GroupSDK.get("3")
                .then((result) => {
                expect(result).toEqual("get");
                expect(GroupOperations.get).toHaveBeenCalledWith("3");
                done();
            })
                .catch((e) => fail(e));
        });
    });
    describe("create", () => {
        test("fails when group ID is invalid", () => {
            expect(() => GroupSDK.create({ groupID: 8 })).toThrow();
            expect(() => GroupSDK.create({ groupID: [] })).toThrow();
            expect(() => GroupSDK.create({ groupID: ",asega" })).toThrow();
            expect(() => GroupSDK.create({ groupID: "\\sega" })).toThrow();
        });
        test("calls group create operation with expected defaults", (done) => {
            const spy = jest.spyOn(GroupOperations, "create");
            spy.mockReturnValue(futurejs_1.default.of("create"));
            GroupSDK.create()
                .then((result) => {
                expect(result).toEqual("create");
                expect(GroupOperations.create).toHaveBeenCalledWith("", "", true, false);
                done();
            })
                .catch((e) => fail(e));
        });
        test("calls group create operation with provided name", (done) => {
            const spy = jest.spyOn(GroupOperations, "create");
            spy.mockReturnValue(futurejs_1.default.of("create"));
            GroupSDK.create({ groupID: "providedGroupID" })
                .then((result) => {
                expect(result).toEqual("create");
                expect(GroupOperations.create).toHaveBeenCalledWith("providedGroupID", "", true, false);
                done();
            })
                .catch((e) => fail(e));
        });
        test("calls group create operation with expected args", (done) => {
            const spy = jest.spyOn(GroupOperations, "create");
            spy.mockReturnValue(futurejs_1.default.of("create"));
            GroupSDK.create({ addAsMember: false })
                .then((result) => {
                expect(result).toEqual("create");
                expect(GroupOperations.create).toHaveBeenCalledWith("", "", false, false);
                done();
            })
                .catch((e) => fail(e));
        });
        test("calls group create with provided name", (done) => {
            const spy = jest.spyOn(GroupOperations, "create");
            spy.mockReturnValue(futurejs_1.default.of("create"));
            GroupSDK.create({ groupName: "abc" })
                .then((result) => {
                expect(result).toEqual("create");
                expect(GroupOperations.create).toHaveBeenCalledWith("", "abc", true, false);
                done();
            })
                .catch((e) => fail(e));
        });
        test("calls group create operation with expected args", (done) => {
            const spy = jest.spyOn(GroupOperations, "create");
            spy.mockReturnValue(futurejs_1.default.of("create"));
            GroupSDK.create({ groupID: "providedID", groupName: "abc", addAsMember: true })
                .then((result) => {
                expect(result).toEqual("create");
                expect(GroupOperations.create).toHaveBeenCalledWith("providedID", "abc", true, false);
                done();
            })
                .catch((e) => fail(e));
        });
        test("calls group create operation with rotation arg", (done) => {
            const spy = jest.spyOn(GroupOperations, "create");
            spy.mockReturnValue(futurejs_1.default.of("create"));
            GroupSDK.create({ groupID: "providedID", groupName: "abc", addAsMember: true, needsRotation: true })
                .then((result) => {
                expect(result).toEqual("create");
                expect(GroupOperations.create).toHaveBeenCalledWith("providedID", "abc", true, true);
                done();
            })
                .catch((e) => fail(e));
        });
    });
    describe("update", () => {
        test("fails validation if groupID is invalid", () => {
            expect(() => GroupSDK.update("^groupID", { groupName: "abc" })).toThrow();
            expect(() => GroupSDK.update("", { groupName: "abc" })).toThrow();
            expect(() => GroupSDK.update("[groupID]", { groupName: "abc" })).toThrow();
        });
        test("fails validation if no group name provided", () => {
            expect(() => GroupSDK.update("groupID", {})).toThrow();
            expect(() => GroupSDK.update("groupID", { groupName: "" })).toThrow();
            expect(() => GroupSDK.update("groupID", { groupName: undefined })).toThrow();
        });
        test("calls group operations to update group with new name", () => {
            const updateSpy = jest.spyOn(GroupOperations, "update");
            updateSpy.mockReturnValue(futurejs_1.default.of("updated group"));
            GroupSDK.update("groupID", { groupName: "new name" })
                .then((group) => {
                expect(group).toEqual("updated group");
                expect(GroupOperations.update).toHaveBeenLastCalledWith("groupID", "new name");
            })
                .catch((e) => fail(e));
        });
        test("calls group operations to clear name via null", () => {
            const updateSpy = jest.spyOn(GroupOperations, "update");
            updateSpy.mockReturnValue(futurejs_1.default.of("cleared name"));
            GroupSDK.update("groupID", { groupName: null })
                .then((group) => {
                expect(group).toEqual("cleared name");
                expect(GroupOperations.update).toHaveBeenLastCalledWith("groupID", null);
            })
                .catch((e) => fail(e));
        });
    });
    describe("rotatePrivateKey", () => {
        test("fails when group ID is not valid", () => {
            expect(() => GroupSDK.rotatePrivateKey("")).toThrow();
        });
        test("calls group private key rotate operation", (done) => {
            jest.spyOn(GroupOperations, "rotateGroupPrivateKey").mockReturnValue(futurejs_1.default.of("rotateGroupPrivateKey"));
            GroupSDK.rotatePrivateKey("6")
                .then((result) => {
                expect(result).toEqual("rotateGroupPrivateKey");
                expect(GroupOperations.rotateGroupPrivateKey).toHaveBeenCalledWith("6");
                done();
            })
                .catch((e) => fail(e));
        });
    });
    describe("addAdmins", () => {
        test("fails validation if groupID or admin list is invalid", () => {
            expect(() => GroupSDK.addAdmins("", [])).toThrow();
            expect(() => GroupSDK.addAdmins("35", [])).toThrow();
            expect(() => GroupSDK.addAdmins("(ID)]", [])).toThrow();
        });
        test("calls group add admins operation", (done) => {
            const spy = jest.spyOn(GroupOperations, "addAdmins");
            spy.mockReturnValue(futurejs_1.default.of("addAdmins"));
            GroupSDK.addAdmins("6", ["5", "36", "894"])
                .then((result) => {
                expect(result).toEqual("addAdmins");
                expect(GroupOperations.addAdmins).toHaveBeenCalledWith("6", ["5", "36", "894"]);
                done();
            })
                .catch((e) => fail(e));
        });
        test("dedupes users in array before submitting", (done) => {
            const spy = jest.spyOn(GroupOperations, "addAdmins");
            spy.mockReturnValue(futurejs_1.default.of("addAdmins"));
            GroupSDK.addAdmins("6", ["5", "36", "5", "611"])
                .then((result) => {
                expect(result).toEqual("addAdmins");
                expect(GroupOperations.addAdmins).toHaveBeenCalledWith("6", ["5", "36", "611"]);
                done();
            })
                .catch((e) => fail(e));
        });
    });
    describe("removeAdmins", () => {
        test("fails validation if groupID or member list is invalid", () => {
            expect(() => GroupSDK.removeAdmins("", [])).toThrow();
            expect(() => GroupSDK.removeAdmins("35", [])).toThrow();
            expect(() => GroupSDK.removeAdmins("3,5", ["ID2"])).toThrow();
        });
        test("calls group remove admins operation", (done) => {
            const spy = jest.spyOn(GroupOperations, "removeAdmins");
            spy.mockReturnValue(futurejs_1.default.of("removeAdmins"));
            GroupSDK.removeAdmins("6", ["5", "36", "894"])
                .then((result) => {
                expect(result).toEqual("removeAdmins");
                expect(GroupOperations.removeAdmins).toHaveBeenCalledWith("6", ["5", "36", "894"]);
                done();
            })
                .catch((e) => fail(e));
        });
        test("dedupes users in array before submitting", (done) => {
            const spy = jest.spyOn(GroupOperations, "removeAdmins");
            spy.mockReturnValue(futurejs_1.default.of("removeAdmins"));
            GroupSDK.removeAdmins("6", ["5", "36", "5", "611"])
                .then((result) => {
                expect(result).toEqual("removeAdmins");
                expect(GroupOperations.removeAdmins).toHaveBeenCalledWith("6", ["5", "36", "611"]);
                done();
            })
                .catch((e) => fail(e));
        });
    });
    describe("addMembers", () => {
        test("fails validation if groupID or member list is invalid", () => {
            expect(() => GroupSDK.addMembers("", [])).toThrow();
            expect(() => GroupSDK.addMembers("35", [])).toThrow();
            expect(() => GroupSDK.addMembers("|$#?", ["id2"])).toThrow();
        });
        test("calls group add members operation", (done) => {
            const spy = jest.spyOn(GroupOperations, "addMembers");
            spy.mockReturnValue(futurejs_1.default.of("addMembers"));
            GroupSDK.addMembers("6", ["5", "36", "894"])
                .then((result) => {
                expect(result).toEqual("addMembers");
                expect(GroupOperations.addMembers).toHaveBeenCalledWith("6", ["5", "36", "894"]);
                done();
            })
                .catch((e) => fail(e));
        });
        test("dedupes users in array before submitting", (done) => {
            const spy = jest.spyOn(GroupOperations, "addMembers");
            spy.mockReturnValue(futurejs_1.default.of("addMembers"));
            GroupSDK.addMembers("6", ["5", "36", "5", "611"])
                .then((result) => {
                expect(result).toEqual("addMembers");
                expect(GroupOperations.addMembers).toHaveBeenCalledWith("6", ["5", "36", "611"]);
                done();
            })
                .catch((e) => fail(e));
        });
    });
    describe("removeMembers", () => {
        test("fails validation if groupID or member list is invalid", () => {
            expect(() => GroupSDK.removeMembers("", [])).toThrow();
            expect(() => GroupSDK.removeMembers("35", [])).toThrow();
            expect(() => GroupSDK.removeMembers("8r%", ["ID1"])).toThrow();
        });
        test("submits list of users to remove", (done) => {
            const spy = jest.spyOn(GroupOperations, "removeMembers");
            spy.mockReturnValue(futurejs_1.default.of("removeMembers"));
            GroupSDK.removeMembers("6", ["5", "36", "894"])
                .then((result) => {
                expect(result).toEqual("removeMembers");
                expect(GroupOperations.removeMembers).toHaveBeenCalledWith("6", ["5", "36", "894"]);
                done();
            })
                .catch((e) => fail(e));
        });
        test("dedupes users in array before submitting", (done) => {
            const spy = jest.spyOn(GroupOperations, "removeMembers");
            spy.mockReturnValue(futurejs_1.default.of("removeMembers"));
            GroupSDK.removeMembers("6", ["5", "36", "5", "611"])
                .then((result) => {
                expect(result).toEqual("removeMembers");
                expect(GroupOperations.removeMembers).toHaveBeenCalledWith("6", ["5", "36", "611"]);
                done();
            })
                .catch((e) => fail(e));
        });
    });
    describe("deleteGroup", () => {
        test("fails validation if groupID or member list is invalid", () => {
            expect(() => GroupSDK.deleteGroup("")).toThrow();
            expect(() => GroupSDK.deleteGroup("8r%")).toThrow();
        });
        test("submits list of users to remove", (done) => {
            const spy = jest.spyOn(GroupOperations, "deleteGroup");
            spy.mockReturnValue(futurejs_1.default.of("deleteGroup"));
            GroupSDK.deleteGroup("6")
                .then((result) => {
                expect(result).toEqual("deleteGroup");
                expect(GroupOperations.deleteGroup).toHaveBeenCalledWith("6");
                done();
            })
                .catch((e) => fail(e));
        });
    });
});
