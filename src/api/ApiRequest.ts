import Future from "futurejs";
import fetch, {RequestInit, Response} from "node-fetch";
import {ed25519Sign} from "../crypto/Recrypt";
import SDKError from "../lib/SDKError";
import {Codec} from "../lib/Utils";
import {ErrorCodes} from "../Constants";
import {MessageSignature, SigningKeyPair} from "../commonTypes";

const SIGNATURE_VERSION = 1;
//const IRONCORE_ID_API_BASE_URL = "https://api.ironcorelabs.com/api/1/";
const IRONCORE_ID_API_BASE_URL = "http://localhost:9090/api/1/";
const CLOUDFLARE_RATE_LIMIT_STATUS_CODE = 429; //support.cloudflare.com/hc/en-us/articles/115001635128-Configuring-Rate-Limiting-in-the-Cloudflare-Dashboard#basic

type ApiErrorList = Array<{
    message: string;
    code: number;
}>;

/**
 * Attempt to parse the first error from the response JSON and convert it into an SDK error with the useful API message and
 * the proper error code for this request.
 * @param {Response} response         API response object from fetch operation
 * @param {number}   failureErrorCode Error code to use when building up SDK Error object
 */
function parseErrorFromFailedResponse(failureResponse: Response, failureErrorCode: number) {
    return Future.tryP(() => failureResponse.json())
        .errorMap(() => new SDKError(new Error(failureResponse.statusText), failureErrorCode))
        .flatMap((errorList: ApiErrorList) => {
            const errorString = errorList && errorList.length > 0 ? errorList[0].message : failureResponse.statusText;
            return Future.reject(new SDKError(new Error(errorString), failureErrorCode));
        });
}

/**
 * Wrap fetch API to automatically decode JSON results before returning since when using the fetch API
 * the JSON parse is async.
 */
export function fetchJSON<ResponseType>(url: string, failureErrorCode: number, options?: RequestInit): Future<SDKError, ResponseType> {
    return Future.tryP(() => fetch(`${IRONCORE_ID_API_BASE_URL}${url}`, options))
        .errorMap((error) => new SDKError(error, failureErrorCode))
        .flatMap((response: Response) => {
            if (response.ok) {
                if (response.status === 204) {
                    return Future.of(undefined);
                }
                return Future.tryP(() => response.json()).errorMap(
                    () => new SDKError(new Error("Failed to parse successful response JSON."), failureErrorCode)
                );
            }
            if (response.status === CLOUDFLARE_RATE_LIMIT_STATUS_CODE) {
                //Map a Cloudflare rate limit response code to a special error code
                return Future.reject(new SDKError(new Error("Request was rate limited from too many requests."), ErrorCodes.REQUEST_RATE_LIMITED));
            }
            return parseErrorFromFailedResponse(response, failureErrorCode);
        });
}

/**
 * Build up header string for Auth token for the APIs that require a signature
 * @param {MessageSignature} signature Signature payload
 */
export function getAuthHeader(signature: MessageSignature) {
    return `IronCore ${signature.version}.${signature.message}.${signature.signature}`;
}

/**
 * Create a message signature of the current time, segment ID, user ID, and public signing key. Encode that as a base64 string and sign it
 * using ed25519.
 */
export function createSignature(segmentID: number, userID: string, signingKeys: SigningKeyPair): MessageSignature {
    const payload = Buffer.from(
        JSON.stringify({
            ts: Date.now(),
            sid: segmentID,
            uid: userID,
            x: Codec.Buffer.toBase64(signingKeys.publicKey),
        })
    );
    return {
        version: SIGNATURE_VERSION,
        message: Codec.Buffer.toBase64(payload),
        signature: Codec.Buffer.toBase64(ed25519Sign(signingKeys.privateKey, payload)),
    };
}
