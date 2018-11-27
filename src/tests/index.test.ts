import Future from "futurejs";
import * as IronNode from "../index";
import * as Initialization from "../sdk/Initialization";

describe("IronNode", () => {
    describe("initialize", () => {
        test("should fail when provided invalid values", () => {
            expect(() => IronNode.initialize("abc def", 3, "aaaa", "aaaa")).toThrow();
            expect(() => IronNode.initialize("abc[]", 3, "aaaa", "aaaa")).toThrow();
            expect(() => IronNode.initialize("abc,def", 3, "aaaa", "aaaa")).toThrow();
            expect(() => IronNode.initialize("abc def", "3" as any, "aaaa", "aaaa")).toThrow();
            expect(() => IronNode.initialize("abc def", "3" as any, "", "aaaa")).toThrow();
            expect(() => IronNode.initialize("abc def", "3" as any, "aaaa", "")).toThrow();
            expect(() => IronNode.initialize("abc def", "3" as any, "aaaa", 94 as any)).toThrow();
        });

        test("should call into init when all parameters appear valid", () => {
            const initSpy = jest.spyOn(Initialization, "initialize");
            initSpy.mockReturnValue(Future.of("init"));
            IronNode.initialize("abc", 3, "aaaa", "aaaa")
                .then((res) => {
                    expect(res).toEqual("init");
                })
                .catch((e) => fail(e));
        });
    });
});
