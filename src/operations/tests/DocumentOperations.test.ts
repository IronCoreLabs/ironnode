import Future from "futurejs";
import * as DocumentOperations from "../DocumentOperations";
import * as DocumentCrypto from "../DocumentCrypto";
import * as TestUtils from "../../tests/TestUtils";
import DocumentApi from "../../api/DocumentApi";
import {generateDocumentHeaderBytes} from "../../lib/Utils";
import {ErrorCodes, VERSION_HEADER_LENGTH, HEADER_META_LENGTH_LENGTH} from "../../Constants";
import UserApi from "../../api/UserApi";
import GroupApi from "../../api/GroupApi";
import ApiState from "../../lib/ApiState";

describe("DocumentOperations", () => {
    beforeEach(() => {
        ApiState.setAccountContext(
            TestUtils.testAccountID,
            TestUtils.testSegmentID,
            TestUtils.accountPublicBytes,
            TestUtils.devicePrivateBytes,
            TestUtils.signingPrivateBytes
        );
    });

    describe("list", () => {
        test("retrieves list of documents from store", (done) => {
            const dataList = [
                {
                    id: "10",
                    name: "my doc 10",
                    association: {type: "owner"},
                },
                {
                    id: "user-12",
                    name: null,
                    association: {type: "fromUser"},
                },
            ];

            const spy = jest.spyOn(DocumentApi, "callDocumentListApi");
            spy.mockReturnValue(Future.of({result: dataList}));

            DocumentOperations.list().engage(
                (e) => fail(e.message),
                (result) => {
                    expect(result).toEqual({
                        result: [
                            {documentID: "10", documentName: "my doc 10", association: "owner"},
                            {documentID: "user-12", documentName: null, association: "fromUser"},
                        ],
                    });
                    done();
                }
            );
        });
    });

    describe("getMetadata", () => {
        test("returns document and maps results", (done) => {
            const docMeta = {
                id: "my-doc",
                name: "My Doc",
                association: {type: "owner"},
                visibleTo: [],
            };

            const spy = jest.spyOn(DocumentApi, "callDocumentMetadataGetApi");
            spy.mockReturnValue(Future.of(docMeta));

            DocumentOperations.getMetadata("my-doc").engage(
                (e) => fail(e.message),
                (result: any) => {
                    expect(result).toEqual({
                        documentID: "my-doc",
                        documentName: "My Doc",
                        association: "owner",
                        visibleTo: [],
                    });
                    expect(DocumentApi.callDocumentMetadataGetApi).toHaveBeenCalledWith("my-doc");
                    done();
                }
            );
        });
    });

    describe("getDocumentIDFromBytes", () => {
        test("should return null if document is version 1", () => {
            const doc = Buffer.from([1, 35, 235, 52]);
            DocumentOperations.getDocumentIDFromBytes(doc).engage(
                (e) => fail(e),
                (result) => {
                    expect(result).toBeNull();
                }
            );
        });

        test("should parse document ID and return it for version 2", () => {
            const doc = Buffer.concat([Buffer.from([2, 0, 16]), Buffer.from(JSON.stringify({_did_: "3333"}))]);
            DocumentOperations.getDocumentIDFromBytes(doc).engage(
                (e) => fail(e),
                (result) => {
                    expect(result).toEqual("3333");
                }
            );
        });

        test("should reject when JSON data is mangled", () => {
            const doc = Buffer.concat([Buffer.from([2, 0, 10]), Buffer.from(JSON.stringify({_did_: "3333"}))]);
            DocumentOperations.getDocumentIDFromBytes(doc).engage(
                (e) => {
                    expect(e.message).toBeString();
                    expect(e.code).toEqual(ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE);
                },
                (result) => {
                    expect(result).toEqual("3333");
                }
            );
        });
    });

    describe("getDocumentIDFromStream", () => {
        test("rejects if it cannot read from stream", (done) => {
            const mockStream = {
                on: jest.fn(),
                read: jest.fn().mockReturnValue(null),
            };

            DocumentOperations.getDocumentIDFromStream(mockStream as any).engage(
                (e) => {
                    expect(e.message).toBeString();
                    expect(e.code).toEqual(ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE);
                    done();
                },
                () => fail("should fail if no data can be read from stream")
            );

            const readableCallback = mockStream.on.mock.calls[0];
            expect(readableCallback[0]).toEqual("readable");
            readableCallback[1]();
        });

        test("resolves with null when data version is 1", (done) => {
            const mockStream = {
                on: jest.fn(),
                read: jest.fn().mockReturnValue(Buffer.from([1])),
            };

            DocumentOperations.getDocumentIDFromStream(mockStream as any).engage(
                (e) => fail(e.message),
                (result) => {
                    expect(result).toBeNull();
                    expect(mockStream.read).toHaveBeenCalledWith(VERSION_HEADER_LENGTH + HEADER_META_LENGTH_LENGTH);
                    done();
                }
            );

            const readableCallback = mockStream.on.mock.calls[0];
            expect(readableCallback[0]).toEqual("readable");
            readableCallback[1]();
        });

        test("rejects when read data isnt of the proper length", (done) => {
            let readCalls = 0;
            const mockStream = {
                on: jest.fn(),
                read: jest.fn().mockImplementation(() => {
                    if (readCalls === 0) {
                        readCalls = 1;
                        return Buffer.from([2, 0, 20]);
                    }
                    return Buffer.from([10, 20, 30, 40]); //Smaller than the 20 we told it above
                }),
            };

            DocumentOperations.getDocumentIDFromStream(mockStream as any).engage(
                (e) => {
                    expect(e.message).toBeString();
                    expect(e.code).toEqual(ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE);
                    expect(mockStream.read).toHaveBeenCalledTimes(2);
                    done();
                },
                () => fail("should fail if header bytes cant be read from stream")
            );

            const readableCallback = mockStream.on.mock.calls[0];
            expect(readableCallback[0]).toEqual("readable");
            readableCallback[1]();
        });

        test("rejects when header JSON is mangled", (done) => {
            let readCalls = 0;
            const mockStream = {
                on: jest.fn(),
                read: jest.fn().mockImplementation(() => {
                    if (readCalls === 0) {
                        readCalls = 1;
                        return Buffer.from([2, 0, 18]);
                    }
                    return Buffer.from(Buffer.from('{"_did_":"abcdeff"')); //Invalid JSON
                }),
            };

            DocumentOperations.getDocumentIDFromStream(mockStream as any).engage(
                (e) => {
                    expect(e.message).toBeString();
                    expect(e.code).toEqual(ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE);
                    expect(mockStream.read).toHaveBeenCalledTimes(2);
                    done();
                },
                () => fail("should fail if header bytes cant be read from stream")
            );

            const readableCallback = mockStream.on.mock.calls[0];
            expect(readableCallback[0]).toEqual("readable");
            readableCallback[1]();
        });

        test("returns document ID from stream", (done) => {
            let readCalls = 0;
            const mockStream = {
                on: jest.fn(),
                read: jest.fn().mockImplementation(() => {
                    if (readCalls === 0) {
                        readCalls = 1;
                        return Buffer.from([2, 0, 18]);
                    }
                    return Buffer.from(Buffer.from('{"_did_":"abcdef"}'));
                }),
            };

            DocumentOperations.getDocumentIDFromStream(mockStream as any).engage(
                (e) => fail(e.message),
                (documentID) => {
                    expect(documentID).toEqual("abcdef");
                    done();
                }
            );

            const readableCallback = mockStream.on.mock.calls[0];
            expect(readableCallback[0]).toEqual("readable");
            readableCallback[1]();
            readableCallback[1]();
        });
    });

    describe("encryptBytes", () => {
        test("encrypts document to current user and returns expected document package", () => {
            const encryptedSymKey = TestUtils.getEncryptedSymmetricKey();

            const encryptSpy = jest.spyOn(DocumentCrypto, "encryptBytes");
            encryptSpy.mockReturnValue(
                Future.of({
                    userAccessKeys: [{id: "10", key: encryptedSymKey}],
                    groupAccessKeys: [],
                    encryptedDocument: Buffer.alloc(55),
                })
            );
            const apiSpy = jest.spyOn(DocumentApi, "callDocumentCreateApi");
            apiSpy.mockReturnValue(Future.of({id: "bar"}));

            DocumentOperations.encryptBytes("my doc ID", Buffer.from([]), "", [], []).engage(
                (e) => fail(e.message),
                ({document, documentID, documentName}) => {
                    expect(documentID).toEqual("bar");
                    expect(documentName).toBeUndefined();
                    expect(document).toEqual(Buffer.alloc(55));
                    const currentUserRecord = {
                        id: "10",
                        masterPublicKey: TestUtils.accountPublicBytesBase64,
                    };
                    expect(DocumentCrypto.encryptBytes).toHaveBeenCalledWith(
                        generateDocumentHeaderBytes("my doc ID", TestUtils.testSegmentID),
                        Buffer.from([]),
                        [currentUserRecord],
                        [],
                        ApiState.signingKeys().privateKey
                    );
                    expect(DocumentApi.callDocumentCreateApi).toHaveBeenCalledWith("my doc ID", [{id: "10", key: encryptedSymKey}], [], "");
                }
            );
        });

        test("sets proper document name when provided", () => {
            const docName = "my doc";
            const encryptedSymKey = TestUtils.getEncryptedSymmetricKey();

            const encryptSpy = jest.spyOn(DocumentCrypto, "encryptBytes");
            encryptSpy.mockReturnValue(
                Future.of({
                    userAccessKeys: [{id: "10", key: encryptedSymKey}],
                    groupAccessKeys: [],
                    encryptedDocument: Buffer.alloc(55),
                })
            );
            const apiSpy = jest.spyOn(DocumentApi, "callDocumentCreateApi");
            apiSpy.mockReturnValue(Future.of({id: "bar", name: docName}));

            DocumentOperations.encryptBytes("my doc ID", Buffer.from([]), docName, [], []).engage(
                (e) => fail(e.message),
                ({document, documentID, documentName}) => {
                    expect(documentID).toEqual("bar");
                    expect(documentName).toEqual(docName);
                    expect(document).toEqual(Buffer.alloc(55));
                }
            );
        });

        test("encrypts to list of users and groups provided", (done) => {
            const encryptedSymKey = TestUtils.getEncryptedSymmetricKey();

            const userSpy = jest.spyOn(UserApi, "callUserKeyListApi");
            userSpy.mockReturnValue(
                Future.of({
                    result: [
                        {id: "user-55", userMasterPublicKey: TestUtils.getEmptyPublicKeyString()},
                        {id: "user-33", userMasterPublicKey: TestUtils.getEmptyPublicKeyString()},
                    ],
                })
            );
            const groupSpy = jest.spyOn(GroupApi, "callGroupKeyListApi");
            groupSpy.mockReturnValue(
                Future.of({
                    result: [{id: "group-20", groupMasterPublicKey: TestUtils.getEmptyPublicKeyString()}],
                })
            );
            const encryptSpy = jest.spyOn(DocumentCrypto, "encryptBytes");
            encryptSpy.mockReturnValue(
                Future.of({
                    userAccessKeys: [{id: "10", key: encryptedSymKey}],
                    groupAccessKeys: [],
                    encryptedDocument: Buffer.alloc(55),
                })
            );
            const docSpy = jest.spyOn(DocumentApi, "callDocumentCreateApi");
            docSpy.mockReturnValue(Future.of({id: "bar"}));

            DocumentOperations.encryptBytes("doc key", Buffer.from([88, 73, 92]), "", ["user-55", "user-33"], ["user-33"]).engage(
                (e) => fail(e.message),
                ({documentID, documentName, document}) => {
                    expect(documentID).toEqual("bar");
                    expect(documentName).toBeUndefined();
                    expect(document).toEqual(Buffer.alloc(55));

                    const userKeyList = [
                        {id: "user-55", masterPublicKey: TestUtils.getEmptyPublicKeyString()},
                        {id: "user-33", masterPublicKey: TestUtils.getEmptyPublicKeyString()},
                        {id: "10", masterPublicKey: TestUtils.accountPublicBytesBase64},
                    ];
                    const groupKeyList = [{id: "group-20", masterPublicKey: TestUtils.getEmptyPublicKeyString()}];

                    expect(DocumentCrypto.encryptBytes).toHaveBeenCalledWith(
                        generateDocumentHeaderBytes("doc key", TestUtils.testSegmentID),
                        Buffer.from([88, 73, 92]),
                        userKeyList,
                        groupKeyList,
                        ApiState.signingKeys().privateKey
                    );
                    expect(DocumentApi.callDocumentCreateApi).toHaveBeenCalledWith("doc key", [{id: "10", key: encryptedSymKey}], [], "");
                    done();
                }
            );
        });

        test("fails if any of the users or groups cannot be found", (done) => {
            const userSpy = jest.spyOn(UserApi, "callUserKeyListApi");
            userSpy.mockReturnValue(
                Future.of({
                    result: [{id: "user-33", userMasterPublicKey: TestUtils.getEmptyPublicKeyString()}],
                })
            );
            const groupSpy = jest.spyOn(GroupApi, "callGroupKeyListApi");
            groupSpy.mockReturnValue(
                Future.of({
                    result: [{id: "group-20", groupMasterPublicKey: TestUtils.getEmptyPublicKeyString()}],
                })
            );

            DocumentOperations.encryptBytes("doc key", Buffer.from([88, 73, 92]), "", ["user-33"], ["group-20", "group-33"]).engage(
                (e) => {
                    expect(e.message).toBeString();
                    expect(e.message).toContain("[group-33]");
                    done();
                },
                () => fail("Should not call create when any user or group could not be found")
            );
        });
    });

    describe("encryptStream", () => {
        test("encrypts document to current user and returns expected document package", () => {
            const encryptedSymKey = TestUtils.getEncryptedSymmetricKey();

            const encryptSpy = jest.spyOn(DocumentCrypto, "encryptStream");
            encryptSpy.mockReturnValue(
                Future.of({
                    userAccessKeys: [{id: "10", key: encryptedSymKey}],
                    groupAccessKeys: [],
                })
            );
            const apiSpy = jest.spyOn(DocumentApi, "callDocumentCreateApi");
            apiSpy.mockReturnValue(Future.of({id: "bar"}));

            DocumentOperations.encryptStream("my doc ID", "inputStream" as any, "outputStream" as any, "", [], []).engage(
                (e) => fail(e.message),
                ({documentID, documentName}) => {
                    expect(documentID).toEqual("bar");
                    expect(documentName).toBeUndefined();
                    const currentUserRecord = {
                        id: "10",
                        masterPublicKey: TestUtils.accountPublicBytesBase64,
                    };
                    expect(DocumentCrypto.encryptStream).toHaveBeenCalledWith(
                        generateDocumentHeaderBytes("my doc ID", TestUtils.testSegmentID),
                        "inputStream",
                        "outputStream",
                        [currentUserRecord],
                        [],
                        ApiState.signingKeys().privateKey
                    );
                    expect(DocumentApi.callDocumentCreateApi).toHaveBeenCalledWith("my doc ID", [{id: "10", key: encryptedSymKey}], [], "");
                }
            );
        });

        test("sets proper document name when provided", () => {
            const docName = "my doc";
            const encryptedSymKey = TestUtils.getEncryptedSymmetricKey();

            const encryptSpy = jest.spyOn(DocumentCrypto, "encryptStream");
            encryptSpy.mockReturnValue(
                Future.of({
                    userAccessKeys: [{id: "10", key: encryptedSymKey}],
                    groupAccessKeys: [],
                })
            );
            const apiSpy = jest.spyOn(DocumentApi, "callDocumentCreateApi");
            apiSpy.mockReturnValue(Future.of({id: "bar", name: docName}));

            DocumentOperations.encryptStream("my doc ID", "inputStream" as any, "outputStream" as any, docName, [], []).engage(
                (e) => fail(e.message),
                ({documentID, documentName}) => {
                    expect(documentID).toEqual("bar");
                    expect(documentName).toEqual(docName);
                }
            );
        });

        test("encrypts to list of users and groups provided", (done) => {
            const encryptedSymKey = TestUtils.getEncryptedSymmetricKey();

            const userSpy = jest.spyOn(UserApi, "callUserKeyListApi");
            userSpy.mockReturnValue(
                Future.of({
                    result: [
                        {id: "user-55", userMasterPublicKey: TestUtils.getEmptyPublicKeyString()},
                        {id: "user-33", userMasterPublicKey: TestUtils.getEmptyPublicKeyString()},
                    ],
                })
            );
            const groupSpy = jest.spyOn(GroupApi, "callGroupKeyListApi");
            groupSpy.mockReturnValue(
                Future.of({
                    result: [{id: "group-20", groupMasterPublicKey: TestUtils.getEmptyPublicKeyString()}],
                })
            );
            const encryptSpy = jest.spyOn(DocumentCrypto, "encryptStream");
            encryptSpy.mockReturnValue(
                Future.of({
                    userAccessKeys: [{id: "10", key: encryptedSymKey}],
                    groupAccessKeys: [],
                })
            );
            const docSpy = jest.spyOn(DocumentApi, "callDocumentCreateApi");
            docSpy.mockReturnValue(Future.of({id: "bar"}));

            DocumentOperations.encryptStream("doc key", "inputStream" as any, "outputStream" as any, "", ["user-55", "user-33"], ["user-33"]).engage(
                (e) => fail(e.message),
                ({documentID, documentName}) => {
                    expect(documentID).toEqual("bar");
                    expect(documentName).toBeUndefined();

                    const userKeyList = [
                        {id: "user-55", masterPublicKey: TestUtils.getEmptyPublicKeyString()},
                        {id: "user-33", masterPublicKey: TestUtils.getEmptyPublicKeyString()},
                        {id: "10", masterPublicKey: TestUtils.accountPublicBytesBase64},
                    ];
                    const groupKeyList = [{id: "group-20", masterPublicKey: TestUtils.getEmptyPublicKeyString()}];

                    expect(DocumentCrypto.encryptStream).toHaveBeenCalledWith(
                        generateDocumentHeaderBytes("doc key", TestUtils.testSegmentID),
                        "inputStream",
                        "outputStream",
                        userKeyList,
                        groupKeyList,
                        ApiState.signingKeys().privateKey
                    );
                    expect(DocumentApi.callDocumentCreateApi).toHaveBeenCalledWith("doc key", [{id: "10", key: encryptedSymKey}], [], "");
                    done();
                }
            );
        });

        test("fails if any of the users or groups cannot be found", (done) => {
            const userSpy = jest.spyOn(UserApi, "callUserKeyListApi");
            userSpy.mockReturnValue(
                Future.of({
                    result: [{id: "user-33", userMasterPublicKey: TestUtils.getEmptyPublicKeyString()}],
                })
            );
            const groupSpy = jest.spyOn(GroupApi, "callGroupKeyListApi");
            groupSpy.mockReturnValue(
                Future.of({
                    result: [{id: "group-20", groupMasterPublicKey: TestUtils.getEmptyPublicKeyString()}],
                })
            );

            DocumentOperations.encryptStream("doc key", "inputStream" as any, "outputStream" as any, "", ["user-33"], ["group-20", "group-33"]).engage(
                (e) => {
                    expect(e.message).toBeString();
                    expect(e.message).toContain("[group-33]");
                    done();
                },
                () => fail("Should not call create when any user or group could not be found")
            );
        });
    });

    describe("decryptBytes", () => {
        test("returns doc in raw bytes", () => {
            const eDoc = Buffer.alloc(22);
            const decryptedBytes = Buffer.from([36, 89, 72]);

            const metaGet = jest.spyOn(DocumentApi, "callDocumentMetadataGetApi");
            metaGet.mockReturnValue(Future.of(TestUtils.getEncryptedDocumentMetaResponse()));
            const decrypt = jest.spyOn(DocumentCrypto, "decryptBytes");
            decrypt.mockReturnValue(Future.of(decryptedBytes));

            DocumentOperations.decryptBytes("docID", eDoc).engage(
                (e) => fail(e.message),
                ({data, documentID, documentName, visibleTo, association}) => {
                    expect(documentID).toEqual("docID");
                    expect(documentName).toEqual("my doc");
                    expect(association).toEqual("owner");
                    expect(visibleTo).toEqual({
                        users: [{id: "user-11"}, {id: "user-33"}],
                        groups: [{id: "group-34", name: "ICL"}],
                    });
                    expect(data).toEqual(decryptedBytes);
                }
            );
        });
    });

    describe("decryptStream", () => {
        test("returns doc info", () => {
            const metaGet = jest.spyOn(DocumentApi, "callDocumentMetadataGetApi");
            metaGet.mockReturnValue(Future.of(TestUtils.getEncryptedDocumentMetaResponse()));
            const decrypt = jest.spyOn(DocumentCrypto, "decryptStream");
            decrypt.mockReturnValue(Future.of(undefined));

            DocumentOperations.decryptStream("docID", "inputStream" as any, "outputFile").engage(
                (e) => fail(e.message),
                ({documentID, documentName, visibleTo, association}) => {
                    expect(documentID).toEqual("docID");
                    expect(documentName).toEqual("my doc");
                    expect(association).toEqual("owner");
                    expect(visibleTo).toEqual({
                        users: [{id: "user-11"}, {id: "user-33"}],
                        groups: [{id: "group-34", name: "ICL"}],
                    });
                }
            );
        });
    });

    describe("updateDocumentBytes", () => {
        test("encrypts new document and returns package", () => {
            const reencrypt = jest.spyOn(DocumentCrypto, "reEncryptBytes");
            reencrypt.mockReturnValue(Future.of(Buffer.alloc(33)));
            const getMeta = jest.spyOn(DocumentApi, "callDocumentMetadataGetApi");
            getMeta.mockReturnValue(Future.of(TestUtils.getEncryptedDocumentMetaResponse()));

            DocumentOperations.updateDocumentBytes("doc id2", Buffer.from([88, 73, 92])).engage(
                (e) => fail(e.message),
                ({documentID, documentName, document}) => {
                    expect(documentID).toEqual("docID");
                    expect(documentName).toEqual("my doc");
                    expect(document).toEqual(Buffer.alloc(33));

                    expect(DocumentCrypto.reEncryptBytes).toHaveBeenCalledWith(
                        generateDocumentHeaderBytes("doc id2", TestUtils.testSegmentID),
                        Buffer.from([88, 73, 92]),
                        TestUtils.getTransformedSymmetricKey(),
                        TestUtils.devicePrivateBytes
                    );
                    expect(DocumentApi.callDocumentMetadataGetApi).toHaveBeenCalledWith("doc id2");
                }
            );
        });
    });

    describe("updateDocumentStream", () => {
        test("encrypts new document and returns meta info", () => {
            const reencrypt = jest.spyOn(DocumentCrypto, "reEncryptStream");
            reencrypt.mockReturnValue(Future.of(undefined));
            const getMeta = jest.spyOn(DocumentApi, "callDocumentMetadataGetApi");
            getMeta.mockReturnValue(Future.of(TestUtils.getEncryptedDocumentMetaResponse()));

            DocumentOperations.updateDocumentStream("doc id2", "inputStream" as any, "outputStream" as any).engage(
                (e) => fail(e.message),
                ({documentID, documentName}) => {
                    expect(documentID).toEqual("docID");
                    expect(documentName).toEqual("my doc");

                    expect(DocumentCrypto.reEncryptStream).toHaveBeenCalledWith(
                        generateDocumentHeaderBytes("doc id2", TestUtils.testSegmentID),
                        "inputStream",
                        "outputStream",
                        TestUtils.getTransformedSymmetricKey(),
                        TestUtils.devicePrivateBytes
                    );
                    expect(DocumentApi.callDocumentMetadataGetApi).toHaveBeenCalledWith("doc id2");
                }
            );
        });
    });

    describe("updateName", () => {
        test("invokes document update API and maps result subset", () => {
            const updateSpy = jest.spyOn(DocumentApi, "callDocumentUpdateApi");
            updateSpy.mockReturnValue(Future.of({id: "bar", name: "updated doc", fromUserId: "user-33"}));

            DocumentOperations.updateDocumentName("doc-10", "new name").engage(
                (e) => fail(e.message),
                (response) => {
                    expect(response).toEqual({
                        documentID: "bar",
                        documentName: "updated doc",
                    });
                    expect(DocumentApi.callDocumentUpdateApi).toHaveBeenCalledWith("doc-10", "new name");
                }
            );
        });
    });

    describe("grantDocumentAccess", () => {
        test("runs all expected API calls and maps results to expected output for list of users", (done) => {
            const userKeys = [{id: "userID", userMasterPublicKey: {x: "getPublicKey"}}];
            const docSymKey = {
                encryptedSymmetricKey: "esk",
                ephemeralPublicKey: "epk",
                authorizationCode: "ac",
            };

            const keyList = jest.spyOn(UserApi, "callUserKeyListApi");
            keyList.mockReturnValue(Future.of({result: userKeys}));
            const metaGet = jest.spyOn(DocumentApi, "callDocumentMetadataGetApi");
            metaGet.mockReturnValue(
                Future.of({
                    encryptedSymmetricKey: docSymKey,
                })
            );
            const grant = jest.spyOn(DocumentApi, "callDocumentGrantApi");
            grant.mockReturnValue(
                Future.of({
                    succeededIds: [{userOrGroup: {type: "user", id: "userID"}}],
                    failedIds: [
                        {
                            userOrGroup: {type: "user", id: "userID2"},
                            errorMessage: "failed user",
                        },
                    ],
                })
            );
            const groupKey = jest.spyOn(GroupApi, "callGroupKeyListApi");
            groupKey.mockReturnValue(Future.of({result: []}));
            const encryptToKeys = jest.spyOn(DocumentCrypto, "encryptDocumentToKeys");
            encryptToKeys.mockReturnValue(
                Future.of({
                    userAccessKeys: ["encryptedUserKey"],
                    groupAccessKeys: [],
                })
            );

            DocumentOperations.grantDocumentAccess("docID", ["userID", "userID2"], []).engage(
                (e) => fail(e.message),
                (data: any) => {
                    expect(data).toEqual({
                        succeeded: [
                            {
                                id: "userID",
                                type: "user",
                            },
                        ],
                        failed: [
                            {
                                id: "userID2",
                                type: "user",
                                error: "failed user",
                            },
                        ],
                    });

                    expect(UserApi.callUserKeyListApi).toHaveBeenCalledWith(["userID", "userID2"]);
                    expect(GroupApi.callGroupKeyListApi).toHaveBeenCalledWith([]);
                    expect(DocumentApi.callDocumentMetadataGetApi).toHaveBeenCalledWith("docID");
                    expect(DocumentCrypto.encryptDocumentToKeys).toHaveBeenCalledWith(
                        docSymKey,
                        [{id: "userID", masterPublicKey: {x: "getPublicKey"}}],
                        [],
                        TestUtils.devicePrivateBytes,
                        ApiState.signingKeys().privateKey
                    );
                    expect(DocumentApi.callDocumentGrantApi).toHaveBeenCalledWith("docID", ["encryptedUserKey"], []);
                    done();
                }
            );
        });

        test("runs all expected operations and maps result for list of groups", (done) => {
            const groupKeys = [{id: "groupID", groupMasterPublicKey: {x: "groupPublicKey"}, foo: "bar"}];
            const docSymKey = {
                encryptedSymmetricKey: "esk",
                ephemeralPublicKey: "epk",
                authorizationCode: "ac",
            };

            const user = jest.spyOn(UserApi, "callUserKeyListApi");
            user.mockReturnValue(Future.of({result: []}));
            const group = jest.spyOn(GroupApi, "callGroupKeyListApi");
            group.mockReturnValue(Future.of({result: groupKeys}));
            const metaGet = jest.spyOn(DocumentApi, "callDocumentMetadataGetApi");
            metaGet.mockReturnValue(
                Future.of({
                    encryptedSymmetricKey: docSymKey,
                })
            );
            const grantSpy = jest.spyOn(DocumentApi, "callDocumentGrantApi");
            grantSpy.mockReturnValue(
                Future.of({
                    succeededIds: [{userOrGroup: {type: "group", id: "groupID"}}],
                    failedIds: [],
                })
            );
            const encryptToKey = jest.spyOn(DocumentCrypto, "encryptDocumentToKeys");
            encryptToKey.mockReturnValue(
                Future.of({
                    userAccessKeys: [],
                    groupAccessKeys: ["encryptedGroupKey"],
                })
            );

            DocumentOperations.grantDocumentAccess("docID", [], ["groupID"]).engage(
                (e) => fail(e.message),
                (data: any) => {
                    expect(data).toEqual({
                        succeeded: [
                            {
                                id: "groupID",
                                type: "group",
                            },
                        ],
                        failed: [],
                    });

                    expect(UserApi.callUserKeyListApi).toHaveBeenCalledWith([]);
                    expect(GroupApi.callGroupKeyListApi).toHaveBeenCalledWith(["groupID"]);
                    expect(DocumentApi.callDocumentMetadataGetApi).toHaveBeenCalledWith("docID");
                    expect(DocumentCrypto.encryptDocumentToKeys).toHaveBeenCalledWith(
                        docSymKey,
                        [],
                        [{id: "groupID", masterPublicKey: {x: "groupPublicKey"}}],
                        TestUtils.devicePrivateBytes,
                        ApiState.signingKeys().privateKey
                    );
                    expect(DocumentApi.callDocumentGrantApi).toHaveBeenCalledWith("docID", [], ["encryptedGroupKey"]);
                    done();
                }
            );
        });

        test("runs all of the above for lists of users and lists of groups", (done) => {
            const userKeys = [{id: "userID1", userMasterPublicKey: {x: "firstuserkey"}}, {id: "userID2", userMasterPublicKey: {x: "seconduserkey"}}];
            const groupKeys = [{id: "groupID1", groupMasterPublicKey: {x: "firstgroupkey"}}, {id: "groupID2", groupMasterPublicKey: {x: "secondgroupkey"}}];
            const docSymKey = {
                encryptedSymmetricKey: "esk",
                ephemeralPublicKey: "epk",
                authorizationCode: "ac",
            };

            const user = jest.spyOn(UserApi, "callUserKeyListApi");
            user.mockReturnValue(Future.of({result: userKeys}));
            const group = jest.spyOn(GroupApi, "callGroupKeyListApi");
            group.mockReturnValue(Future.of({result: groupKeys}));
            const metaGet = jest.spyOn(DocumentApi, "callDocumentMetadataGetApi");
            metaGet.mockReturnValue(
                Future.of({
                    encryptedSymmetricKey: docSymKey,
                })
            );
            const grantSpy = jest.spyOn(DocumentApi, "callDocumentGrantApi");
            grantSpy.mockReturnValue(
                Future.of({
                    succeededIds: [{userOrGroup: {type: "group", id: "groupID1"}}, {userOrGroup: {type: "user", id: "userID2"}}],
                    failedIds: [
                        {userOrGroup: {type: "group", id: "groupID2"}, errorMessage: "foo"},
                        {userOrGroup: {type: "user", id: "userID1"}, errorMessage: "bar"},
                    ],
                })
            );
            const encryptToKeys = jest.spyOn(DocumentCrypto, "encryptDocumentToKeys");
            encryptToKeys.mockReturnValue(
                Future.of({
                    userAccessKeys: ["encryptedUserKey"],
                    groupAccessKeys: ["encryptedGroupKey"],
                })
            );

            DocumentOperations.grantDocumentAccess("docID", ["userID1", "userID2"], ["groupID1", "groupID2"]).engage(
                (e) => fail(e.message),
                (data: any) => {
                    expect(data).toEqual({
                        succeeded: [{id: "groupID1", type: "group"}, {id: "userID2", type: "user"}],
                        failed: [{id: "groupID2", type: "group", error: "foo"}, {id: "userID1", type: "user", error: "bar"}],
                    });

                    expect(UserApi.callUserKeyListApi).toHaveBeenCalledWith(["userID1", "userID2"]);
                    expect(GroupApi.callGroupKeyListApi).toHaveBeenCalledWith(["groupID1", "groupID2"]);
                    expect(DocumentApi.callDocumentMetadataGetApi).toHaveBeenCalledWith("docID");
                    expect(DocumentCrypto.encryptDocumentToKeys).toHaveBeenCalledWith(
                        docSymKey,
                        [{id: "userID1", masterPublicKey: {x: "firstuserkey"}}, {id: "userID2", masterPublicKey: {x: "seconduserkey"}}],
                        [{id: "groupID1", masterPublicKey: {x: "firstgroupkey"}}, {id: "groupID2", masterPublicKey: {x: "secondgroupkey"}}],
                        TestUtils.devicePrivateBytes,
                        ApiState.signingKeys().privateKey
                    );
                    expect(DocumentApi.callDocumentGrantApi).toHaveBeenCalledWith("docID", ["encryptedUserKey"], ["encryptedGroupKey"]);
                    done();
                }
            );
        });

        test("returns failures for users or groups that dont exist", (done) => {
            const userKeys = [{id: "userID1", userMasterPublicKey: {x: "firstuserkey"}}, {id: "userID2", userMasterPublicKey: {x: "seconduserkey"}}];
            const groupKeys = [{id: "groupID1", groupMasterPublicKey: {x: "firstgroupkey"}}];
            const docSymKey = {
                encryptedSymmetricKey: "esk",
                ephemeralPublicKey: "epk",
                authorizationCode: "ac",
            };

            const user = jest.spyOn(UserApi, "callUserKeyListApi");
            user.mockReturnValue(Future.of({result: userKeys}));
            const group = jest.spyOn(GroupApi, "callGroupKeyListApi");
            group.mockReturnValue(Future.of({result: groupKeys}));
            const metaGet = jest.spyOn(DocumentApi, "callDocumentMetadataGetApi");
            metaGet.mockReturnValue(
                Future.of({
                    id: "stored ID",
                    encryptedSymmetricKey: docSymKey,
                })
            );
            const grantSpy = jest.spyOn(DocumentApi, "callDocumentGrantApi");
            grantSpy.mockReturnValue(
                Future.of({
                    succeededIds: [{userOrGroup: {type: "group", id: "groupID1"}}, {userOrGroup: {type: "user", id: "userID2"}}],
                    failedIds: [
                        {userOrGroup: {type: "group", id: "groupID2"}, errorMessage: "foo"},
                        {userOrGroup: {type: "user", id: "userID1"}, errorMessage: "bar"},
                    ],
                })
            );
            const encryptToKeys = jest.spyOn(DocumentCrypto, "encryptDocumentToKeys");
            encryptToKeys.mockReturnValue(
                Future.of({
                    userAccessKeys: ["encryptedUserKey"],
                    groupAccessKeys: ["encryptedGroupKey"],
                })
            );

            DocumentOperations.grantDocumentAccess(
                "docID",
                ["userID1", "userID2", "userID3", "userID4"],
                ["groupID1", "groupID2", "groupID3", "groupID4"]
            ).engage(
                (e) => fail(e.message),
                (data: any) => {
                    expect(data).toEqual({
                        succeeded: [{id: "groupID1", type: "group"}, {id: "userID2", type: "user"}],
                        failed: [
                            {id: "groupID2", type: "group", error: "foo"},
                            {id: "userID1", type: "user", error: "bar"},
                            {id: "userID3", type: "user", error: "ID did not exist in the system."},
                            {id: "userID4", type: "user", error: "ID did not exist in the system."},
                            {id: "groupID3", type: "group", error: "ID did not exist in the system."},
                            {id: "groupID4", type: "group", error: "ID did not exist in the system."},
                        ],
                    });

                    expect(UserApi.callUserKeyListApi).toHaveBeenCalledWith(["userID1", "userID2", "userID3", "userID4"]);
                    expect(GroupApi.callGroupKeyListApi).toHaveBeenCalledWith(["groupID1", "groupID2", "groupID3", "groupID4"]);
                    done();
                }
            );
        });

        test("bails early and returns failures when no users or groups can be found", (done) => {
            const user = jest.spyOn(UserApi, "callUserKeyListApi");
            user.mockReturnValue(Future.of({result: []}));
            const group = jest.spyOn(GroupApi, "callGroupKeyListApi");
            group.mockReturnValue(Future.of({result: []}));
            const metaGet = jest.spyOn(DocumentApi, "callDocumentMetadataGetApi");
            metaGet.mockReturnValue(Future.of({}));
            jest.spyOn(DocumentCrypto, "encryptDocumentToKeys");

            DocumentOperations.grantDocumentAccess("docID", ["userID1", "userID2"], ["groupID1"]).engage(
                (e) => fail(e.message),
                (data: any) => {
                    expect(data).toEqual({
                        succeeded: [],
                        failed: [
                            {id: "userID1", type: "user", error: "ID did not exist in the system."},
                            {id: "userID2", type: "user", error: "ID did not exist in the system."},
                            {id: "groupID1", type: "group", error: "ID did not exist in the system."},
                        ],
                    });

                    expect(DocumentCrypto.encryptDocumentToKeys).not.toHaveBeenCalled();
                    done();
                }
            );
        });
    });

    describe("revokeDocumentAccess", () => {
        test("calls document revoke API and returns with expected mapped result", () => {
            const revokeApi = jest.spyOn(DocumentApi, "callDocumentRevokeApi");
            revokeApi.mockReturnValue(
                Future.of({
                    succeededIds: [{userOrGroup: {type: "group", id: "groupID1"}}, {userOrGroup: {type: "user", id: "userID2"}}],
                    failedIds: [
                        {userOrGroup: {type: "group", id: "groupID2"}, errorMessage: "foo"},
                        {userOrGroup: {type: "user", id: "userID1"}, errorMessage: "bar"},
                    ],
                })
            );

            DocumentOperations.revokeDocumentAccess("docID", ["userID1", "userID2"], ["groupID1", "groupID2"]).engage(
                (e) => fail(e.message),
                (result) => {
                    expect(result).toEqual({
                        succeeded: [{id: "groupID1", type: "group"}, {id: "userID2", type: "user"}],
                        failed: [{id: "groupID2", type: "group", error: "foo"}, {id: "userID1", type: "user", error: "bar"}],
                    });
                }
            );
        });
    });
});
