import Future from "futurejs";
import * as GroupSDK from "../GroupSDK";
import * as GroupOperations from "../../operations/GroupOperations";

describe("GroupSDK", () => {
    describe("list", () => {
        test("sends message to frame and maps message", (done) => {
            const spy = jest.spyOn(GroupOperations, "list");
            spy.mockReturnValue(Future.of("list"));
            GroupSDK.list()
                .then((result: any) => {
                    expect(result).toEqual("list");
                    expect(GroupOperations.list).toHaveBeenCalledWith();
                    done();
                })
                .catch((e) => fail(e));
        });
    });

    describe("get", () => {
        test("fails when group ID is invalid", () => {
            expect(() => GroupSDK.get(8 as any)).toThrow();
            expect(() => GroupSDK.get("")).toThrow();
            expect(() => GroupSDK.get("`ID")).toThrow();
        });

        test("sends payload to frame", (done) => {
            const spy = jest.spyOn(GroupOperations, "get");
            spy.mockReturnValue(Future.of("get"));
            GroupSDK.get("3")
                .then((result: any) => {
                    expect(result).toEqual("get");
                    expect(GroupOperations.get).toHaveBeenCalledWith("3");
                    done();
                })
                .catch((e) => fail(e));
        });
    });

    describe("create", () => {
        test("fails when group ID is invalid", () => {
            expect(() => GroupSDK.create({groupID: 8} as any)).toThrow();
            expect(() => GroupSDK.create({groupID: []} as any)).toThrow();
            expect(() => GroupSDK.create({groupID: ",asega"} as any)).toThrow();
            expect(() => GroupSDK.create({groupID: "\\sega"} as any)).toThrow();
        });

        test("sends create message to frame with default options if nothing is passed in", (done) => {
            const spy = jest.spyOn(GroupOperations, "create");
            spy.mockReturnValue(Future.of("create"));
            GroupSDK.create()
                .then((result: any) => {
                    expect(result).toEqual("create");
                    expect(GroupOperations.create).toHaveBeenCalledWith("", "", true);
                    done();
                })
                .catch((e) => fail(e));
        });

        test("sends create message to frame with groupID if that value is valid and passes as an option", (done) => {
            const spy = jest.spyOn(GroupOperations, "create");
            spy.mockReturnValue(Future.of("create"));
            GroupSDK.create({groupID: "providedGroupID"})
                .then((result: any) => {
                    expect(result).toEqual("create");
                    expect(GroupOperations.create).toHaveBeenCalledWith("providedGroupID", "", true);
                    done();
                })
                .catch((e) => fail(e));
        });

        test("sends create message to frame with addAsMemberValue if that value is passed in as options", (done) => {
            const spy = jest.spyOn(GroupOperations, "create");
            spy.mockReturnValue(Future.of("create"));
            GroupSDK.create({addAsMember: false})
                .then((result: any) => {
                    expect(result).toEqual("create");
                    expect(GroupOperations.create).toHaveBeenCalledWith("", "", false);
                    done();
                })
                .catch((e) => fail(e));
        });

        test("sends create message to frame with groupName if that value is passed in as options", (done) => {
            const spy = jest.spyOn(GroupOperations, "create");
            spy.mockReturnValue(Future.of("create"));
            GroupSDK.create({groupName: "abc"})
                .then((result: any) => {
                    expect(result).toEqual("create");
                    expect(GroupOperations.create).toHaveBeenCalledWith("", "abc", true);
                    done();
                })
                .catch((e) => fail(e));
        });

        test("sends create message to frame with options passed in if provided", (done) => {
            const spy = jest.spyOn(GroupOperations, "create");
            spy.mockReturnValue(Future.of("create"));
            GroupSDK.create({groupID: "providedID", groupName: "abc", addAsMember: true})
                .then((result: any) => {
                    expect(result).toEqual("create");
                    expect(GroupOperations.create).toHaveBeenCalledWith("providedID", "abc", true);
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

        test("sends add admins message to frame", (done) => {
            const spy = jest.spyOn(GroupOperations, "addAdmins");
            spy.mockReturnValue(Future.of("addAdmins"));
            GroupSDK.addAdmins("6", ["5", "36", "894"])
                .then((result: any) => {
                    expect(result).toEqual("addAdmins");
                    expect(GroupOperations.addAdmins).toHaveBeenCalledWith("6", ["5", "36", "894"]);
                    done();
                })
                .catch((e) => fail(e));
        });

        test("dedupes users in array before submitting", (done) => {
            const spy = jest.spyOn(GroupOperations, "addAdmins");
            spy.mockReturnValue(Future.of("addAdmins"));
            GroupSDK.addAdmins("6", ["5", "36", "5", "611"])
                .then((result: any) => {
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

        test("sends remove members message to frame", (done) => {
            const spy = jest.spyOn(GroupOperations, "removeAdmins");
            spy.mockReturnValue(Future.of("removeAdmins"));
            GroupSDK.removeAdmins("6", ["5", "36", "894"])
                .then((result: any) => {
                    expect(result).toEqual("removeAdmins");
                    expect(GroupOperations.removeAdmins).toHaveBeenCalledWith("6", ["5", "36", "894"]);
                    done();
                })
                .catch((e) => fail(e));
        });

        test("dedupes users in array before submitting", (done) => {
            const spy = jest.spyOn(GroupOperations, "removeAdmins");
            spy.mockReturnValue(Future.of("removeAdmins"));
            GroupSDK.removeAdmins("6", ["5", "36", "5", "611"])
                .then((result: any) => {
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

        test("sends add members message to frame", (done) => {
            const spy = jest.spyOn(GroupOperations, "addMembers");
            spy.mockReturnValue(Future.of("addMembers"));
            GroupSDK.addMembers("6", ["5", "36", "894"])
                .then((result: any) => {
                    expect(result).toEqual("addMembers");
                    expect(GroupOperations.addMembers).toHaveBeenCalledWith("6", ["5", "36", "894"]);
                    done();
                })
                .catch((e) => fail(e));
        });

        test("dedupes users in array before submitting", (done) => {
            const spy = jest.spyOn(GroupOperations, "addMembers");
            spy.mockReturnValue(Future.of("addMembers"));
            GroupSDK.addMembers("6", ["5", "36", "5", "611"])
                .then((result: any) => {
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

        test("sends remove members message to frame", (done) => {
            const spy = jest.spyOn(GroupOperations, "removeMembers");
            spy.mockReturnValue(Future.of("removeMembers"));
            GroupSDK.removeMembers("6", ["5", "36", "894"])
                .then((result: any) => {
                    expect(result).toEqual("removeMembers");
                    expect(GroupOperations.removeMembers).toHaveBeenCalledWith("6", ["5", "36", "894"]);
                    done();
                })
                .catch((e) => fail(e));
        });

        test("dedupes users in array before submitting", (done) => {
            const spy = jest.spyOn(GroupOperations, "removeMembers");
            spy.mockReturnValue(Future.of("removeMembers"));
            GroupSDK.removeMembers("6", ["5", "36", "5", "611"])
                .then((result: any) => {
                    expect(result).toEqual("removeMembers");
                    expect(GroupOperations.removeMembers).toHaveBeenCalledWith("6", ["5", "36", "611"]);
                    done();
                })
                .catch((e) => fail(e));
        });
    });
});
