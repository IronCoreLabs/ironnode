import * as ApiRequest from "../ApiRequest";
import {ErrorCodes} from "../../Constants";
import {getSigningKeyPair} from "../../tests/TestUtils";

describe("ApiRequest", () => {
    describe("fetchJSON", () => {
        beforeEach(() => {
            global.fetch = jest.fn().mockResolvedValue({
                foo: "bar",
            } as any);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test("invokes fetch with expected parameters", () => {
            const fetchFuture = ApiRequest.fetchJSON("api/method", -1, {method: "POST"});
            fetchFuture.engage(() => null, () => null);
            expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/1/api/method"), {method: "POST"});
        });

        test("converts failed request to SDK error", (done) => {
            (global.fetch as jest.Mock).mockReturnValue(Promise.reject(new Error("forced error")));

            ApiRequest.fetchJSON("api/method", -1, {method: "POST"}).engage(
                (error) => {
                    expect(error.message).toEqual("forced error");
                    expect(error.code).toEqual(-1);
                    done();
                },
                () => done.fail("success method should not be called when fetch fails")
            );
        });

        test("converts failed request with JSON error into SDK Error", (done) => {
            (global.fetch as jest.Mock).mockReturnValue(
                Promise.resolve({
                    ok: false,
                    statusText: "not good",
                    json: () => Promise.resolve([{message: "API response error message"}]) as Promise<any>,
                })
            );

            ApiRequest.fetchJSON("api/method", -1, {method: "POST"}).engage(
                (error) => {
                    expect(error.message).toEqual("API response error message");
                    expect(error.code).toEqual(-1);
                    done();
                },
                () => done.fail("success method should not be called when fetch fails")
            );
        });

        test("falls back to status text if response JSON is not in the expected format", (done) => {
            (global.fetch as jest.Mock).mockReturnValue(
                Promise.resolve({
                    ok: false,
                    statusText: "not good",
                    json: () => Promise.resolve(null) as Promise<any>,
                })
            );

            ApiRequest.fetchJSON("api/method", -1, {method: "POST"}).engage(
                (error) => {
                    expect(error.message).toEqual("not good");
                    expect(error.code).toEqual(-1);
                    done();
                },
                () => done.fail("success method should not be called when fetch fails")
            );
        });

        test("falls back to status text if response body cannot be JSON parsed", (done) => {
            (global.fetch as jest.Mock).mockReturnValue(
                Promise.resolve({
                    ok: false,
                    statusText: "not good",
                    json: () => Promise.reject(new Error("could not parse API response JSON")),
                })
            );

            ApiRequest.fetchJSON("api/method", -1, {method: "POST"}).engage(
                (error) => {
                    expect(error.message).toEqual("not good");
                    expect(error.code).toEqual(-1);
                    done();
                },
                () => done.fail("success method should not be called when fetch fails")
            );
        });

        test("returns empty object if request status is a 204", (done) => {
            (global.fetch as jest.Mock).mockReturnValue(Promise.resolve({ok: true, status: 204}));

            ApiRequest.fetchJSON("api/method", -1, {method: "POST"}).engage(
                (e) => done.fail(e),
                (response: any) => {
                    expect(response).toBeUndefined();
                    done();
                }
            );
        });

        test("falls back to hardcoded message text when response is success but JSON parsing fails", (done) => {
            (global.fetch as jest.Mock).mockReturnValue(
                Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.reject(new Error("json parse failed")),
                })
            );

            ApiRequest.fetchJSON("api/method", -1, {method: "POST"}).engage(
                (error) => {
                    expect(error.message).toBeString();
                    expect(error.code).toEqual(-1);
                    done();
                },
                () => done.fail("success should not be invoked when JSON parsing fails")
            );
        });

        test("invokes response.json on result and maps data to result and response", (done) => {
            (global.fetch as jest.Mock).mockReturnValue(
                Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({foo: "bar"}) as Promise<any>,
                })
            );

            ApiRequest.fetchJSON("api/method", -1, {method: "POST"}).engage(
                (e) => done.fail(e),
                (response: any) => {
                    expect(response).toEqual({
                        foo: "bar",
                    });
                    done();
                }
            );
        });

        test("returns special rate limiting error message when 429 response is returned", () => {
            (global.fetch as jest.Mock).mockReturnValue(
                Promise.resolve({
                    ok: false,
                    status: 429,
                })
            );

            ApiRequest.fetchJSON("group/get", -1, {method: "GET"}).engage(
                (e) => {
                    expect(e.code).toEqual(ErrorCodes.REQUEST_RATE_LIMITED);
                    expect(e.message).toBeString();
                },
                () => fail("Should not succeed when response returns 429 error.")
            );
        });
    });

    describe("getAuthHeader", () => {
        test("creates composite of fields", () => {
            const sig = {
                version: 1,
                message: "abc",
                signature: "xyz",
            };

            expect(ApiRequest.getAuthHeader(sig)).toEqual("IronCore 1.abc.xyz");
        });
    });

    describe("createSignature", () => {
        test("return signature object with required fields", () => {
            const signature = ApiRequest.createSignature(12, "user-id-10", getSigningKeyPair());

            expect(signature.version).toBeNumber();
            expect(signature.message).toBeString();
            expect(signature.message.length).toEqual(132);
            expect(signature.signature).toBeString();
            expect(signature.signature.length).toEqual(88);
        });
    });
});
