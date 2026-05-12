import {ErrorCodes} from "../../Constants";
import SDKError from "../SDKError";
import * as SDKState from "../SDKState";

describe("SDKState", () => {
    afterEach(() => {
        SDKState.clearSDKInitialized();
    });

    test("starts in the uninitialized state", () => {
        expect(SDKState.isSDKInitialized()).toBe(false);
    });

    test("setSDKInitialized flips the flag to true", () => {
        SDKState.setSDKInitialized();
        expect(SDKState.isSDKInitialized()).toBe(true);
    });

    test("clearSDKInitialized flips the flag back to false", () => {
        SDKState.setSDKInitialized();
        SDKState.clearSDKInitialized();
        expect(SDKState.isSDKInitialized()).toBe(false);
    });

    describe("checkSDKInitialized", () => {
        test("does not throw when initialized", () => {
            SDKState.setSDKInitialized();
            expect(() => SDKState.checkSDKInitialized()).not.toThrow();
        });

        test("throws an SDKError with code SDK_NOT_INITIALIZED when not initialized", () => {
            try {
                SDKState.checkSDKInitialized();
                fail("Expected checkSDKInitialized to throw");
            } catch (e) {
                expect(e).toBeInstanceOf(SDKError);
                expect((e as SDKError).code).toEqual(ErrorCodes.SDK_NOT_INITIALIZED);
                expect((e as SDKError).message).toMatch(/initialize/);
            }
        });
    });
});
