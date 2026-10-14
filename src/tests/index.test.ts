import Future from "futurejs";
import {SDK} from "../../ironnode";
import * as IronNode from "../index";
import * as UserOperations from "../operations/UserOperations";
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

        test("should validate DeviceContext fields", () => {
            const valid = {accountId: "abc", segmentId: 3, devicePrivateKey: "aaaa", signingPrivateKey: "bbbb"};
            expect(() => IronNode.initialize({...valid, accountId: ""})).toThrow();
            expect(() => IronNode.initialize({...valid, segmentId: "3" as unknown as number})).toThrow();
            expect(() => IronNode.initialize({...valid, devicePrivateKey: ""})).toThrow();
            expect(() => IronNode.initialize({...valid, signingPrivateKey: ""})).toThrow();
            expect(() => IronNode.initialize({accountID: "abc", segmentID: 3} as unknown as typeof valid)).toThrow();
        });

        test("should initialize from the fields of a DeviceContext", () => {
            const sdk = {} as SDK;
            const initSpy = jest.spyOn(Initialization, "initialize");
            initSpy.mockReturnValue(Future.of(sdk));
            return IronNode.initialize({accountId: "abc", segmentId: 3, devicePrivateKey: "aaaa", signingPrivateKey: "bbbb"}).then((res) => {
                expect(res).toBe(sdk);
                expect(initSpy).toHaveBeenCalledWith("abc", 3, "aaaa", "bbbb");
            });
        });
    });

    describe("User", () => {
        test("verify", () => {
            const verifySpy = jest.spyOn(Initialization, "userVerify");
            verifySpy.mockReturnValue(Future.of("verify") as any);
            IronNode.User.verify("jwt")
                .then((res) => {
                    expect(res).toEqual("verify");
                })
                .catch((e) => fail(e));
        });

        test("create with no options", () => {
            const createSpy = jest.spyOn(Initialization, "createUser").mockReturnValue(Future.of("create") as any);
            IronNode.User.create("jwt", "password")
                .then((res) => {
                    expect(res).toEqual("create");
                    expect(createSpy).toHaveBeenCalledWith("jwt", "password", {needsRotation: false});
                })
                .catch((e) => fail(e));
        });

        test("create with provided options", () => {
            const createSpy = jest.spyOn(Initialization, "createUser").mockReturnValue(Future.of("create") as any);
            IronNode.User.create("jwt", "password", {needsRotation: true})
                .then((res) => {
                    expect(res).toEqual("create");
                    expect(createSpy).toHaveBeenCalledWith("jwt", "password", {needsRotation: true});
                })
                .catch((e) => fail(e));
        });

        test("generateDeviceKeys", () => {
            const genDeviceSpy = jest.spyOn(Initialization, "generateDevice");
            genDeviceSpy.mockReturnValue(Future.of("genDevice") as any);
            IronNode.User.generateDeviceKeys("jwt", "password")
                .then((res) => {
                    expect(res).toEqual("genDevice");
                    expect(Initialization.generateDevice).toHaveBeenCalledWith("jwt", "password", {deviceName: ""});
                })
                .catch((e) => fail(e));
        });

        describe("updateStatus", () => {
            test("rejects an empty JWT", () => {
                expect(() => IronNode.User.updateStatus("", 0)).toThrow();
                expect(() => (IronNode.User as any).updateStatus(null, 0)).toThrow();
            });

            test("rejects an invalid status value", () => {
                expect(() => (IronNode.User as any).updateStatus("jwt", 2)).toThrow();
                expect(() => (IronNode.User as any).updateStatus("jwt", "active")).toThrow();
            });

            test("calls UserOperations.updateUserStatus with provided JWT and status", (done) => {
                const spy = jest.spyOn(UserOperations, "updateUserStatus");
                spy.mockReturnValue(Future.of("updated") as any);
                IronNode.User.updateStatus("the.jwt.token", IronNode.UserStatus.Enabled)
                    .then((res) => {
                        expect(res).toEqual("updated");
                        expect(UserOperations.updateUserStatus).toHaveBeenCalledWith("the.jwt.token", 1);
                        done();
                    })
                    .catch((e) => done.fail(e));
            });
        });

        test("deleteDeviceByPublicSigningKey rejects an empty JWT or signing key", () => {
            expect(() => IronNode.User.deleteDeviceByPublicSigningKey("", "AAAA")).toThrow(/JWT/);
            expect(() => IronNode.User.deleteDeviceByPublicSigningKey("the.jwt", "")).toThrow(/signing key/);
        });
    });

    describe("UserStatus", () => {
        test("exposes Disabled (0) and Enabled (1) constants", () => {
            expect(IronNode.UserStatus.Disabled).toEqual(0);
            expect(IronNode.UserStatus.Enabled).toEqual(1);
        });
    });
});
