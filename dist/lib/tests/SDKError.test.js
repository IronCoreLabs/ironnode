"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SDKError_1 = require("../SDKError");
describe("SDKError", () => {
    test("sets error and code as expected when given a native JS error", () => {
        const error = new Error("test error");
        const sdkE = new SDKError_1.default(error, 10);
        expect(sdkE.code).toEqual(10);
        expect(sdkE.message).toEqual("test error");
        expect(sdkE.rawError).toEqual(error);
    });
    test("uses existing SDKError code and message when given an existing SDKError", () => {
        const origError = new SDKError_1.default(new Error("wrapped"), 20);
        const newError = new SDKError_1.default(origError, 50);
        expect(newError.code).toEqual(20);
        expect(newError.rawError).toEqual(origError.rawError);
    });
});
