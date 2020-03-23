"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const node_fetch_1 = require("node-fetch");
const Constants_1 = require("../Constants");
const Recrypt_1 = require("../crypto/Recrypt");
const SDKError_1 = require("../lib/SDKError");
const Utils_1 = require("../lib/Utils");
const SIGNATURE_VERSION = 1;
const IRONCORE_ID_API_BASE_URL = `${process.env._ICL_API_DOMAIN_REPLACEMENT_ || "https://api.ironcorelabs.com"}/api/1/`;
const CLOUDFLARE_RATE_LIMIT_STATUS_CODE = 429;
function parseErrorFromFailedResponse(failureResponse, failureErrorCode) {
    return futurejs_1.default.tryP(() => failureResponse.json())
        .errorMap(() => new SDKError_1.default(new Error(failureResponse.statusText), failureErrorCode))
        .flatMap((errorList) => {
        const errorString = errorList && errorList.length > 0 ? errorList[0].message : failureResponse.statusText;
        return futurejs_1.default.reject(new SDKError_1.default(new Error(errorString), failureErrorCode));
    });
}
function fetchJSON(url, failureErrorCode, options) {
    return futurejs_1.default.tryP(() => node_fetch_1.default(`${IRONCORE_ID_API_BASE_URL}${url}`, options))
        .errorMap((error) => new SDKError_1.default(error, failureErrorCode))
        .flatMap((response) => {
        if (response.ok) {
            if (response.status === 204) {
                return futurejs_1.default.of(undefined);
            }
            return futurejs_1.default.tryP(() => response.json()).errorMap(() => new SDKError_1.default(new Error("Failed to parse successful response JSON."), failureErrorCode));
        }
        if (response.status === CLOUDFLARE_RATE_LIMIT_STATUS_CODE) {
            return futurejs_1.default.reject(new SDKError_1.default(new Error("Request was denied due to rate limiting."), Constants_1.ErrorCodes.REQUEST_RATE_LIMITED));
        }
        return parseErrorFromFailedResponse(response, failureErrorCode);
    });
}
exports.fetchJSON = fetchJSON;
function getAuthHeader(signature) {
    return `IronCore ${signature.version}.${signature.message}.${signature.signature}`;
}
exports.getAuthHeader = getAuthHeader;
function createSignature(segmentID, userID, signingKeys) {
    const payload = Buffer.from(JSON.stringify({
        ts: Date.now(),
        sid: segmentID,
        uid: userID,
        x: Utils_1.Codec.Buffer.toBase64(signingKeys.publicKey),
    }));
    return {
        version: SIGNATURE_VERSION,
        message: Utils_1.Codec.Buffer.toBase64(payload),
        signature: Utils_1.Codec.Buffer.toBase64(Recrypt_1.ed25519Sign(signingKeys.privateKey, payload)),
    };
}
exports.createSignature = createSignature;
