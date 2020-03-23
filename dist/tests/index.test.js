"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const IronNode = require("../index");
const Initialization = require("../sdk/Initialization");
describe("IronNode", () => {
    describe("initialize", () => {
        test("should fail when provided invalid values", () => {
            expect(() => IronNode.initialize("abc def", 3, "aaaa", "aaaa")).toThrow();
            expect(() => IronNode.initialize("abc[]", 3, "aaaa", "aaaa")).toThrow();
            expect(() => IronNode.initialize("abc,def", 3, "aaaa", "aaaa")).toThrow();
            expect(() => IronNode.initialize("abcdef", "3", "aaaa", "aaaa")).toThrow();
            expect(() => IronNode.initialize("abcdef", 3, "", "aaaa")).toThrow();
            expect(() => IronNode.initialize("abcdef", 3, "aaaa", "")).toThrow();
            expect(() => IronNode.initialize("abcdef", 3, "aaaa", 94)).toThrow();
        });
        test("should call into init when all parameters appear valid", () => {
            const initSpy = jest.spyOn(Initialization, "initialize");
            initSpy.mockReturnValue(futurejs_1.default.of("init"));
            IronNode.initialize("abc", 3, "aaaa", "aaaa")
                .then((res) => {
                expect(res).toEqual("init");
            })
                .catch((e) => fail(e));
        });
    });
    describe("User", () => {
        test("verify", () => {
            const verifySpy = jest.spyOn(Initialization, "userVerify");
            verifySpy.mockReturnValue(futurejs_1.default.of("verify"));
            IronNode.User.verify("jwt")
                .then((res) => {
                expect(res).toEqual("verify");
            })
                .catch((e) => fail(e));
        });
        test("create with no options", () => {
            const createSpy = jest.spyOn(Initialization, "createUser").mockReturnValue(futurejs_1.default.of("create"));
            IronNode.User.create("jwt", "password")
                .then((res) => {
                expect(res).toEqual("create");
                expect(createSpy).toHaveBeenCalledWith("jwt", "password", { needsRotation: false });
            })
                .catch((e) => fail(e));
        });
        test("create with provided options", () => {
            const createSpy = jest.spyOn(Initialization, "createUser").mockReturnValue(futurejs_1.default.of("create"));
            IronNode.User.create("jwt", "password", { needsRotation: true })
                .then((res) => {
                expect(res).toEqual("create");
                expect(createSpy).toHaveBeenCalledWith("jwt", "password", { needsRotation: true });
            })
                .catch((e) => fail(e));
        });
        test("generateDeviceKeys", () => {
            const genDeviceSpy = jest.spyOn(Initialization, "generateDevice");
            genDeviceSpy.mockReturnValue(futurejs_1.default.of("genDevice"));
            IronNode.User.generateDeviceKeys("jwt", "password")
                .then((res) => {
                expect(res).toEqual("genDevice");
                expect(Initialization.generateDevice).toHaveBeenCalledWith("jwt", "password", { deviceName: "" });
            })
                .catch((e) => fail(e));
        });
    });
});
