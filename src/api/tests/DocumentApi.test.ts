import Future from "futurejs";
import {EncryptedAccessKey} from "../../commonTypes";
import ApiState from "../../lib/ApiState";
import * as TestUtils from "../../tests/TestUtils";
import * as ApiRequest from "../ApiRequest";
import DocumentApi from "../DocumentApi";

describe("DocumentApi", () => {
    beforeEach(() => {
        jest.spyOn(ApiRequest, "fetchJSON").mockReturnValue(
            Future.of({
                foo: "bar",
            })
        );
        return ApiState.setAccountContext(...TestUtils.getTestApiState());
    });

    afterEach(() => {
        (ApiRequest.fetchJSON as jest.Mock).mockClear();
    });

    describe("callDocumentListApi", () => {
        test("requests document list endpoint and maps response to data result", (done) => {
            DocumentApi.callDocumentListApi().engage(
                (e) => done.fail(e.message),
                (documents: any) => {
                    expect(documents).toEqual({foo: "bar"});
                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("documents", expect.any(Number), expect.any(Object));
                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                    done();
                }
            );
        });
    });

    describe("callDocumentCreateApi", () => {
        test("sends both lists of users and groups when provided", (done) => {
            const symKey = TestUtils.getEncryptedSymmetricKey();
            const userKeyList = [
                {
                    publicKey: {x: "firstuserpublickeyx", y: "firstuserpublickeyy"},
                    encryptedPlaintext: symKey,
                    id: "user-10",
                },
                {
                    publicKey: {x: "seconduserpublickeyx", y: "seconduserpublickeyy"},
                    encryptedPlaintext: symKey,
                    id: "user-350",
                },
            ];

            const groupKeyList = [
                {
                    publicKey: {x: "firstgrouppublickeyx", y: "firstgrouppublickeyy"},
                    encryptedPlaintext: symKey,
                    id: "group-93",
                },
                {
                    publicKey: {x: "secondgrouppublickeyx", y: "secondgrouppublickeyy"},
                    encryptedPlaintext: symKey,
                    id: "group-53",
                },
            ];

            DocumentApi.callDocumentCreateApi("", userKeyList, groupKeyList).engage(
                (e) => done.fail(e.message),
                (document: any) => {
                    expect(document).toEqual({foo: "bar"});
                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("documents", expect.any(Number), expect.any(Object));

                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                    expect(JSON.parse(request.body)).toEqual({
                        value: {
                            fromUserId: "10",
                            sharedWith: [
                                {...symKey, userOrGroup: {type: "user", id: "user-10", masterPublicKey: {x: "firstuserpublickeyx", y: "firstuserpublickeyy"}}},
                                {
                                    ...symKey,
                                    userOrGroup: {type: "user", id: "user-350", masterPublicKey: {x: "seconduserpublickeyx", y: "seconduserpublickeyy"}},
                                },
                                {
                                    ...symKey,
                                    userOrGroup: {type: "group", id: "group-93", masterPublicKey: {x: "firstgrouppublickeyx", y: "firstgrouppublickeyy"}},
                                },
                                {
                                    ...symKey,
                                    userOrGroup: {type: "group", id: "group-53", masterPublicKey: {x: "secondgrouppublickeyx", y: "secondgrouppublickeyy"}},
                                },
                            ],
                        },
                    });
                    done();
                }
            );
        });

        test("optionally stores document data and nonce", (done) => {
            const symKey = TestUtils.getEncryptedSymmetricKey();
            const userKeyList = [
                {
                    publicKey: {x: "firstpublickeyx", y: "firstpublickeyy"},
                    encryptedPlaintext: symKey,
                    id: "user-10",
                },
            ];

            DocumentApi.callDocumentCreateApi("docKey", userKeyList, []).engage(
                (e) => done.fail(e.message),
                (document: any) => {
                    expect(document).toEqual({foo: "bar"});
                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("documents", expect.any(Number), expect.any(Object));

                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                    expect(JSON.parse(request.body)).toEqual({
                        id: "docKey",
                        value: {
                            fromUserId: "10",
                            sharedWith: [
                                {
                                    ...symKey,
                                    userOrGroup: {
                                        type: "user",
                                        id: "user-10",
                                        masterPublicKey: {x: "firstpublickeyx", y: "firstpublickeyy"},
                                    },
                                },
                            ],
                        },
                    });
                    done();
                }
            );
        });
    });

    describe("callDocumentMetadataGetApi", () => {
        test("gets metadata for document and maps result", (done) => {
            DocumentApi.callDocumentMetadataGetApi("docID").engage(
                (e) => done.fail(e.message),
                (document: any) => {
                    expect(document).toEqual({foo: "bar"});

                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("documents/docID", expect.any(Number), expect.any(Object));

                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                    done();
                }
            );
        });
    });

    describe("callDocumentUpdateApi", () => {
        test("includes document name", (done) => {
            DocumentApi.callDocumentUpdateApi("docKey", "new name").engage(
                (e) => done.fail(e.message),
                () => {
                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("documents/docKey", expect.any(Number), expect.any(Object));

                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(JSON.parse(request.body)).toEqual({
                        name: "new name",
                    });
                    done();
                }
            );
        });

        test("sets name to null if passed in as such", (done) => {
            DocumentApi.callDocumentUpdateApi("docKey", null).engage(
                (e) => done.fail(e.message),
                () => {
                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("documents/docKey", expect.any(Number), expect.any(Object));

                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(JSON.parse(request.body)).toEqual({
                        name: null,
                    });
                    done();
                }
            );
        });
    });

    describe("callDocumentGrantApi", () => {
        let userKeys: EncryptedAccessKey[];
        let groupKeys: EncryptedAccessKey[];
        beforeEach(() => {
            userKeys = [
                {
                    publicKey: {x: "firstpublickeyx", y: "firstpublickeyy"},
                    encryptedPlaintext: {
                        ephemeralPublicKey: {x: "", y: "AA=="},
                        encryptedMessage: "AAA=",
                        authHash: "AA==",
                        publicSigningKey: "AAAA",
                        signature: "A===",
                    },
                    id: "37",
                },
                {
                    publicKey: {x: "secondpublickey", y: "secondpublickeyy"},
                    encryptedPlaintext: {
                        ephemeralPublicKey: {x: "AAAAAA==", y: "AAAA"},
                        encryptedMessage: "AA==",
                        authHash: "AA==",
                        publicSigningKey: "AA==",
                        signature: "A===",
                    },
                    id: "99",
                },
            ];

            groupKeys = [
                {
                    publicKey: {x: "grouppublickeyx", y: "grouppublickeyy"},
                    encryptedPlaintext: {
                        ephemeralPublicKey: {x: "AAAAAAA=", y: "AAAAA=="},
                        encryptedMessage: "AAAA",
                        authHash: "AA==",
                        publicSigningKey: "AA==",
                        signature: "A===",
                    },
                    id: "355",
                },
            ];
        });

        test("calls grant API and returns mapped API response", (done) => {
            DocumentApi.callDocumentGrantApi("docID", userKeys, groupKeys).engage(
                (e) => done.fail(e.message),
                (document: any) => {
                    expect(document).toEqual({foo: "bar"});
                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("documents/docID/access", expect.any(Number), expect.any(Object));

                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                    expect(JSON.parse(request.body)).toEqual({
                        fromPublicKey: TestUtils.accountPublicBytesBase64,
                        to: [
                            {
                                encryptedMessage: "AAA=",
                                ephemeralPublicKey: {x: "", y: "AA=="},
                                publicSigningKey: "AAAA",
                                authHash: "AA==",
                                signature: "A===",
                                userOrGroup: {
                                    type: "user",
                                    id: "37",
                                    masterPublicKey: {x: "firstpublickeyx", y: "firstpublickeyy"},
                                },
                            },
                            {
                                encryptedMessage: "AA==",
                                publicSigningKey: "AA==",
                                authHash: "AA==",
                                signature: "A===",
                                ephemeralPublicKey: {x: "AAAAAA==", y: "AAAA"},
                                userOrGroup: {
                                    type: "user",
                                    id: "99",
                                    masterPublicKey: {x: "secondpublickey", y: "secondpublickeyy"},
                                },
                            },
                            {
                                encryptedMessage: "AAAA",
                                ephemeralPublicKey: {x: "AAAAAAA=", y: "AAAAA=="},
                                publicSigningKey: "AA==",
                                authHash: "AA==",
                                signature: "A===",
                                userOrGroup: {
                                    type: "group",
                                    id: "355",
                                    masterPublicKey: {x: "grouppublickeyx", y: "grouppublickeyy"},
                                },
                            },
                        ],
                    });
                    done();
                }
            );
        });

        test("responds with proper key list when no users", (done) => {
            DocumentApi.callDocumentGrantApi("docID", [], groupKeys).engage(
                (e) => done.fail(e.message),
                () => {
                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(JSON.parse(request.body)).toEqual({
                        fromPublicKey: TestUtils.accountPublicBytesBase64,
                        to: [
                            {
                                encryptedMessage: "AAAA",
                                publicSigningKey: "AA==",
                                authHash: "AA==",
                                signature: "A===",
                                ephemeralPublicKey: {x: "AAAAAAA=", y: "AAAAA=="},
                                userOrGroup: {
                                    type: "group",
                                    id: "355",
                                    masterPublicKey: {x: "grouppublickeyx", y: "grouppublickeyy"},
                                },
                            },
                        ],
                    });
                    done();
                }
            );
        });

        test("responds with proper key list when no groups", (done) => {
            DocumentApi.callDocumentGrantApi("docID", userKeys, []).engage(
                (e) => done.fail(e.message),
                () => {
                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(JSON.parse(request.body)).toEqual({
                        fromPublicKey: TestUtils.accountPublicBytesBase64,
                        to: [
                            {
                                encryptedMessage: "AAA=",
                                publicSigningKey: "AAAA",
                                authHash: "AA==",
                                signature: "A===",
                                ephemeralPublicKey: {x: "", y: "AA=="},
                                userOrGroup: {
                                    type: "user",
                                    id: "37",
                                    masterPublicKey: {x: "firstpublickeyx", y: "firstpublickeyy"},
                                },
                            },
                            {
                                encryptedMessage: "AA==",
                                publicSigningKey: "AA==",
                                authHash: "AA==",
                                signature: "A===",
                                ephemeralPublicKey: {x: "AAAAAA==", y: "AAAA"},
                                userOrGroup: {
                                    type: "user",
                                    id: "99",
                                    masterPublicKey: {x: "secondpublickey", y: "secondpublickeyy"},
                                },
                            },
                        ],
                    });
                    done();
                }
            );
        });
    });

    describe("callDocumentRevokeApi", () => {
        test("calls document revoke endpoint with both user and group list", (done) => {
            DocumentApi.callDocumentRevokeApi("docID", ["user-1", "user-2"], ["group-1"]).engage(
                (e) => done.fail(e.message),
                (revokeResult: any) => {
                    expect(revokeResult).toEqual({foo: "bar"});
                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("documents/docID/access", expect.any(Number), expect.any(Object));

                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                    expect(JSON.parse(request.body)).toEqual({
                        userOrGroups: [
                            {id: "user-1", type: "user"},
                            {id: "user-2", type: "user"},
                            {id: "group-1", type: "group"},
                        ],
                    });
                    done();
                }
            );
        });

        test("builds list without users if none are provided", (done) => {
            DocumentApi.callDocumentRevokeApi("docID", [], ["group-1"]).engage(
                (e) => done.fail(e.message),
                (revokeResult: any) => {
                    expect(revokeResult).toEqual({foo: "bar"});
                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("documents/docID/access", expect.any(Number), expect.any(Object));

                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(JSON.parse(request.body)).toEqual({
                        userOrGroups: [{id: "group-1", type: "group"}],
                    });
                    done();
                }
            );
        });

        test("builds list without users if none are provided", (done) => {
            DocumentApi.callDocumentRevokeApi("docID?=10", ["user-1"], []).engage(
                (e) => done.fail(e.message),
                (revokeResult: any) => {
                    expect(revokeResult).toEqual({foo: "bar"});
                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("documents/docID%3F%3D10/access", expect.any(Number), expect.any(Object));

                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(JSON.parse(request.body)).toEqual({
                        userOrGroups: [{id: "user-1", type: "user"}],
                    });
                    done();
                }
            );
        });
    });
});
