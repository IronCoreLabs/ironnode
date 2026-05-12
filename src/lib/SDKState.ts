/**
 * Public-surface initialization flag. Kept separate from `ApiState` (which stores the
 * cryptographic context with definite-assignment types) so the lifecycle gate at the
 * SDK boundary doesn't require nullable accessors on every keyed field. Every method
 * on the `SDK` object returned from `initialize()` calls `checkSDKInitialized()` at
 * the top so post-disable / post-current-device-delete calls fail cleanly here
 * instead of signing requests with revoked keys deeper in the stack.
 */
let hasInitializedSDK = false;

export function setSDKInitialized() {
    hasInitializedSDK = true;
}

export function clearSDKInitialized() {
    hasInitializedSDK = false;
}

export function isSDKInitialized(): boolean {
    return hasInitializedSDK;
}

export function checkSDKInitialized(): void {
    if (!hasInitializedSDK) {
        throw new Error(
            'SDK is not initialized. Either `initialize()` has not been called, or this session was terminated by `disableSelf()` or by deleting the current device.'
        );
    }
}
