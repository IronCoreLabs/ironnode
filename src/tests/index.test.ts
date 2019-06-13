import Future from "futurejs";
import * as IronNode from "../index";
import * as Initialization from "../sdk/Initialization";

describe("IronNode", () => {
    describe("initialize", () => {
        test("should fail when provided invalid values", () => {
            expect(() => IronNode.initialize("abc def", 3, "aaaa", "aaaa")).toThrow();
            expect(() => IronNode.initialize("abc[]", 3, "aaaa", "aaaa")).toThrow();
            expect(() => IronNode.initialize("abc,def", 3, "aaaa", "aaaa")).toThrow();
            expect(() => IronNode.initialize("abcdef", "3" as any, "aaaa", "aaaa")).toThrow();
            expect(() => IronNode.initialize("abcdef", 3, "", "aaaa")).toThrow();
            expect(() => IronNode.initialize("abcdef", 3, "aaaa", "")).toThrow();
            expect(() => IronNode.initialize("abcdef", 3, "aaaa", 94 as any)).toThrow();
        });

        test("should call into init when all parameters appear valid", () => {
            const initSpy = jest.spyOn(Initialization, "initialize");
            initSpy.mockReturnValue(Future.of("init") as any);
            IronNode.initialize("abc", 3, "aaaa", "aaaa")
                .then((res) => {
                    expect(res).toEqual("init");
                })
                .catch((e) => fail(e));
        });
    });

    describe("User", () => {
        describe("verify", () => {
            const verifySpy = jest.spyOn(Initialization, "userVerify");
            verifySpy.mockReturnValue(Future.of("verify") as any);
            IronNode.User.verify("jwt")
                .then((res) => {
                    expect(res).toEqual("verify");
                })
                .catch((e) => fail(e));
        });

        describe("create", () => {
            const createSpy = jest.spyOn(Initialization, "createUser");
            createSpy.mockReturnValue(Future.of("create") as any);
            IronNode.User.create("jwt", "password")
                .then((res) => {
                    expect(res).toEqual("create");
                })
                .catch((e) => fail(e));
        });

        describe("generateDeviceKeys", () => {
            const genDeviceSpy = jest.spyOn(Initialization, "generateDevice");
            genDeviceSpy.mockReturnValue(Future.of("genDevice") as any);
            IronNode.User.generateDeviceKeys("jwt", "password")
                .then((res) => {
                    expect(res).toEqual("genDevice");
                    expect(Initialization.generateDevice).toHaveBeenCalledWith("jwt", "password", {deviceName: ""});
                })
                .catch((e) => fail(e));
        });
    });
});
