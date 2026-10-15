import Future from "futurejs";
import {SDK} from "../../ironnode";
import * as IronNode from "../index";
import * as SDKState from "../lib/SDKState";
import * as UserOperations from "../operations/UserOperations";
import * as Initialization from "../sdk/Initialization";
import * as TestUtils from "./TestUtils";

interface StubResponse {
    status: number;
    body?: unknown;
}
interface SentRequest {
    method: string;
    path: string;
    authorization: string;
}

/**
 * Replaces `fetch` with a server that answers `"METHOD path"` routes, `path` relative to `/api/1/`, and records every request it receives.
 */
const stubApi = (routes: Record<string, StubResponse>) => {
    const sent: SentRequest[] = [];
    const fakeFetch = (url: string, init: RequestInit = {}) => {
        const method = init.method ?? "GET";
        const path = url.replace(/^.*\/api\/1\//, "");
        const headers: HeadersInit = init.headers ?? {};
        sent.push({method, path, authorization: "Authorization" in headers ? String(headers.Authorization) : ""});
        const route = routes[`${method} ${path}`];
        if (!route) {
            return Promise.reject(new Error(`Unexpected request ${method} ${path}`));
        }
        return Promise.resolve({ok: route.status < 300, status: route.status, statusText: "", json: () => Promise.resolve(route.body)});
    };
    // Jest 26's node environment has no `fetch` global to spy on.
    global.fetch = fakeFetch as unknown as typeof fetch;
    return sent;
};

const ownPublicSigningKey = TestUtils.signingPrivateBytes.slice(32).toString("base64");
const deviceContext = {
    accountId: TestUtils.testAccountID,
    segmentId: TestUtils.testSegmentID,
    devicePrivateKey: TestUtils.devicePrivateBytes.toString("base64"),
    signingPrivateKey: TestUtils.signingPrivateBytes.toString("base64"),
};
const currentUserRoute: Record<string, StubResponse> = {
    "GET users/current": {
        status: 200,
        body: {
            id: TestUtils.testAccountID,
            segmentId: TestUtils.testSegmentID,
            status: 1,
            userMasterPublicKey: TestUtils.accountPublicBytesBase64,
            userPrivateKey: TestUtils.accountEncryptedPrivateKeyBytes.toString("base64"),
            currentKeyId: TestUtils.testCurrentKeyId,
            needsRotation: false,
            groupsNeedingRotation: [],
        },
    },
};

describe("IronNode", () => {
    afterEach(() => {
        Reflect.deleteProperty(global, "fetch");
        SDKState.clearSDKInitialized();
    });

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

        test.each<[string, () => Promise<SDK>]>([
            ["a DeviceContext", () => IronNode.initialize(deviceContext)],
            [
                "a pre-1.3.0 device",
                () =>
                    IronNode.initialize({
                        accountID: deviceContext.accountId,
                        segmentID: deviceContext.segmentId,
                        deviceKeys: {privateKey: deviceContext.devicePrivateKey},
                        signingKeys: {privateKey: deviceContext.signingPrivateKey},
                    }),
            ],
            [
                "separate arguments",
                () => IronNode.initialize(deviceContext.accountId, deviceContext.segmentId, deviceContext.devicePrivateKey, deviceContext.signingPrivateKey),
            ],
        ])("initializes from %s, signing requests as that device", async (_, initialize) => {
            const sent = stubApi(currentUserRoute);
            const sdk = await initialize();
            expect(sdk.userContext).toEqual({userNeedsRotation: false, groupsNeedingRotation: []});
            expect(sent).toHaveLength(1);
            const [, signedMessage] = sent[0].authorization.split(".");
            expect(JSON.parse(Buffer.from(signedMessage, "base64").toString("utf8"))).toMatchObject({
                uid: TestUtils.testAccountID,
                sid: TestUtils.testSegmentID,
                x: ownPublicSigningKey,
            });
        });

        test("should validate DeviceContext fields", () => {
            const valid = {accountId: "abc", segmentId: 3, devicePrivateKey: "aaaa", signingPrivateKey: "bbbb"};
            expect(() => IronNode.initialize({...valid, accountId: ""})).toThrow();
            expect(() => IronNode.initialize({...valid, segmentId: "3" as unknown as number})).toThrow();
            expect(() => IronNode.initialize({...valid, devicePrivateKey: ""})).toThrow();
            expect(() => IronNode.initialize({...valid, signingPrivateKey: ""})).toThrow();
            expect(() => IronNode.initialize({accountID: "abc", segmentID: 3} as unknown as typeof valid)).toThrow();
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
