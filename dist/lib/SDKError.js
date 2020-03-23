"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function isSDKError(error) {
    return typeof error.code === "number";
}
class SDKError extends Error {
    constructor(error, code) {
        super(error.message);
        if (isSDKError(error)) {
            this.code = error.code;
            this.rawError = error.rawError;
        }
        else {
            this.code = code;
            this.rawError = error;
        }
        Object.setPrototypeOf(this, SDKError.prototype);
    }
}
exports.default = SDKError;
