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

        test("throws when not initialized", () => {
            expect(() => SDKState.checkSDKInitialized()).toThrow(/initialize/);
        });
    });
});
