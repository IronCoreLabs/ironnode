"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const DocumentApi_1 = require("../../api/DocumentApi");
const GroupApi_1 = require("../../api/GroupApi");
const UserApi_1 = require("../../api/UserApi");
const Constants_1 = require("../../Constants");
const ApiState_1 = require("../../lib/ApiState");
const Utils_1 = require("../../lib/Utils");
const TestUtils = require("../../tests/TestUtils");
const DocumentCrypto = require("../DocumentCrypto");
const DocumentOperations = require("../DocumentOperations");
describe("DocumentOperations", () => {
    beforeEach(() => {
        ApiState_1.default.setAccountContext(...TestUtils.getTestApiState());
    });
    describe("list", () => {
        test("retrieves list of documents from store", (done) => {
            const dataList = [
                {
                    id: "10",
                    name: "my doc 10",
                    association: { type: "owner" },
                    created: "1",
                    updated: "2",
                },
                {
                    id: "user-12",
                    name: null,
                    association: { type: "fromUser" },
                    created: "3",
                    updated: "4",
                },
            ];
            const spy = jest.spyOn(DocumentApi_1.default, "callDocumentListApi");
            spy.mockReturnValue(futurejs_1.default.of({ result: dataList }));
            DocumentOperations.list().engage((e) => fail(e.message), (result) => {
                expect(result).toEqual({
                    result: [
                        { documentID: "10", documentName: "my doc 10", association: "owner", created: "1", updated: "2" },
                        { documentID: "user-12", documentName: null, association: "fromUser", created: "3", updated: "4" },
                    ],
                });
                done();
            });
        });
    });
    describe("getMetadata", () => {
        test("returns document and maps results", (done) => {
            const docMeta = {
                id: "my-doc",
                name: "My Doc",
                association: { type: "owner" },
                visibleTo: [],
                created: "1",
                updated: "2",
            };
            const spy = jest.spyOn(DocumentApi_1.default, "callDocumentMetadataGetApi");
            spy.mockReturnValue(futurejs_1.default.of(docMeta));
            DocumentOperations.getMetadata("my-doc").engage((e) => fail(e.message), (result) => {
                expect(result).toEqual({
                    documentID: "my-doc",
                    documentName: "My Doc",
                    association: "owner",
                    visibleTo: [],
                    created: "1",
                    updated: "2",
                });
                expect(DocumentApi_1.default.callDocumentMetadataGetApi).toHaveBeenCalledWith("my-doc");
                done();
            });
        });
    });
    describe("getDocumentIDFromBytes", () => {
        test("should return null if document is version 1", () => {
            const doc = Buffer.from([1, 35, 235, 52]);
            DocumentOperations.getDocumentIDFromBytes(doc).engage((e) => fail(e), (result) => {
                expect(result).toBeNull();
            });
        });
        test("should reject if leading byte is not one of the supported versions", () => {
            const doc = Buffer.from([8, 35, 13, 53]);
            DocumentOperations.getDocumentIDFromBytes(doc).engage((e) => {
                expect(e.message).toBeString();
                expect(e.code).toEqual(Constants_1.ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE);
            }, () => fail("Should not succeed when version isn't a supported value."));
        });
        test("should parse document ID and return it for version 2", () => {
            const doc = Buffer.concat([Buffer.from([2, 0, 16]), Buffer.from(JSON.stringify({ _did_: "3333" }))]);
            DocumentOperations.getDocumentIDFromBytes(doc).engage((e) => fail(e), (result) => {
                expect(result).toEqual("3333");
            });
        });
        test("should reject when JSON data is mangled", () => {
            const doc = Buffer.concat([Buffer.from([2, 0, 10]), Buffer.from(JSON.stringify({ _did_: "3333" }))]);
            DocumentOperations.getDocumentIDFromBytes(doc).engage((e) => {
                expect(e.message).toBeString();
                expect(e.code).toEqual(Constants_1.ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE);
            }, (result) => {
                expect(result).toEqual("3333");
            });
        });
    });
    describe("getDocumentIDFromStream", () => {
        test("rejects if it cannot read from stream", (done) => {
            const mockStream = {
                on: jest.fn(),
                read: jest.fn().mockReturnValue(null),
            };
            DocumentOperations.getDocumentIDFromStream(mockStream).engage((e) => {
                expect(e.message).toBeString();
                expect(e.code).toEqual(Constants_1.ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE);
                done();
            }, () => fail("should fail if no data can be read from stream"));
            const readableCallback = mockStream.on.mock.calls[0];
            expect(readableCallback[0]).toEqual("readable");
            readableCallback[1]();
        });
        test("should reject if leading byte is not one of the supported versions", (done) => {
            const mockStream = {
                on: jest.fn(),
                read: jest.fn().mockReturnValue(Buffer.from([8])),
            };
            DocumentOperations.getDocumentIDFromStream(mockStream).engage((e) => {
                expect(e.message).toBeString();
                expect(e.code).toEqual(Constants_1.ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE);
                done();
            }, () => fail("should fail if no data can be read from stream"));
            const readableCallback = mockStream.on.mock.calls[0];
            expect(readableCallback[0]).toEqual("readable");
            readableCallback[1]();
        });
        test("resolves with null when data version is 1", (done) => {
            const mockStream = {
                on: jest.fn(),
                read: jest.fn().mockReturnValue(Buffer.from([1])),
            };
            DocumentOperations.getDocumentIDFromStream(mockStream).engage((e) => fail(e.message), (result) => {
                expect(result).toBeNull();
                expect(mockStream.read).toHaveBeenCalledWith(Constants_1.VERSION_HEADER_LENGTH + Constants_1.HEADER_META_LENGTH_LENGTH);
                done();
            });
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
                    return Buffer.from([10, 20, 30, 40]);
                }),
            };
            DocumentOperations.getDocumentIDFromStream(mockStream).engage((e) => {
                expect(e.message).toBeString();
                expect(e.code).toEqual(Constants_1.ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE);
                expect(mockStream.read).toHaveBeenCalledTimes(2);
                done();
            }, () => fail("should fail if header bytes cant be read from stream"));
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
                    return Buffer.from(Buffer.from('{"_did_":"abcdeff"'));
                }),
            };
            DocumentOperations.getDocumentIDFromStream(mockStream).engage((e) => {
                expect(e.message).toBeString();
                expect(e.code).toEqual(Constants_1.ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE);
                expect(mockStream.read).toHaveBeenCalledTimes(2);
                done();
            }, () => fail("should fail if header bytes cant be read from stream"));
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
            DocumentOperations.getDocumentIDFromStream(mockStream).engage((e) => fail(e.message), (documentID) => {
                expect(documentID).toEqual("abcdef");
                done();
            });
            const readableCallback = mockStream.on.mock.calls[0];
            expect(readableCallback[0]).toEqual("readable");
            readableCallback[1]();
            readableCallback[1]();
        });
    });
    describe("encryptBytes", () => {
        test("encrypts document to current user and returns expected document package", () => {
            const encryptedSymKey = TestUtils.getEncryptedSymmetricKey();
            const encryptBytes = jest.spyOn(DocumentCrypto, "encryptBytes");
            encryptBytes.mockReturnValue(futurejs_1.default.of(Buffer.alloc(33)));
            const encryptSpy = jest.spyOn(DocumentCrypto, "encryptPlaintextToUsersAndGroups");
            encryptSpy.mockReturnValue(futurejs_1.default.of({
                userAccessKeys: [{ id: "10", key: encryptedSymKey }],
                groupAccessKeys: [],
                encryptedDocument: Buffer.alloc(55),
            }));
            const apiSpy = jest.spyOn(DocumentApi_1.default, "callDocumentCreateApi");
            apiSpy.mockReturnValue(futurejs_1.default.of({ id: "bar", created: "1", updated: "2" }));
            DocumentOperations.encryptBytes("my doc ID", Buffer.from([]), "", [], [], true).engage((e) => fail(e.message), ({ document, documentID, documentName, created, updated }) => {
                expect(documentID).toEqual("bar");
                expect(documentName).toBeUndefined();
                expect(created).toEqual("1");
                expect(updated).toEqual("2");
                expect(document).toEqual(Buffer.alloc(33));
                const currentUserRecord = {
                    id: "10",
                    masterPublicKey: TestUtils.accountPublicBytesBase64,
                };
                expect(DocumentCrypto.encryptPlaintextToUsersAndGroups).toHaveBeenCalledWith(jasmine.any(Buffer), [currentUserRecord], [], ApiState_1.default.signingKeys().privateKey);
                expect(DocumentCrypto.encryptBytes).toHaveBeenCalledWith(Utils_1.generateDocumentHeaderBytes("my doc ID", TestUtils.testSegmentID), Buffer.from([]), jasmine.any(Buffer));
                expect(DocumentApi_1.default.callDocumentCreateApi).toHaveBeenCalledWith("my doc ID", [{ id: "10", key: encryptedSymKey }], [], "");
            });
        });
        test("sets proper document name when provided", () => {
            const docName = "my doc";
            const encryptedSymKey = TestUtils.getEncryptedSymmetricKey();
            const encryptBytes = jest.spyOn(DocumentCrypto, "encryptBytes");
            encryptBytes.mockReturnValue(futurejs_1.default.of(Buffer.alloc(33)));
            const encryptSpy = jest.spyOn(DocumentCrypto, "encryptPlaintextToUsersAndGroups");
            encryptSpy.mockReturnValue(futurejs_1.default.of({
                userAccessKeys: [{ id: "10", key: encryptedSymKey }],
                groupAccessKeys: [],
                encryptedDocument: Buffer.alloc(33),
            }));
            const apiSpy = jest.spyOn(DocumentApi_1.default, "callDocumentCreateApi");
            apiSpy.mockReturnValue(futurejs_1.default.of({ id: "bar", name: docName, created: "1", updated: "2" }));
            DocumentOperations.encryptBytes("my doc ID", Buffer.from([]), docName, [], [], true).engage((e) => fail(e.message), ({ document, documentID, documentName, created, updated }) => {
                expect(documentID).toEqual("bar");
                expect(documentName).toEqual(docName);
                expect(document).toEqual(Buffer.alloc(33));
                expect(created).toEqual("1");
                expect(updated).toEqual("2");
            });
        });
        test("encrypts to list of users and groups provided and not author if requested", (done) => {
            const encryptedSymKey = TestUtils.getEncryptedSymmetricKey();
            const userSpy = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userSpy.mockReturnValue(futurejs_1.default.of({
                result: [
                    { id: "user-55", userMasterPublicKey: TestUtils.getEmptyPublicKeyString() },
                    { id: "user-33", userMasterPublicKey: TestUtils.getEmptyPublicKeyString() },
                ],
            }));
            const groupSpy = jest.spyOn(GroupApi_1.default, "callGroupKeyListApi");
            groupSpy.mockReturnValue(futurejs_1.default.of({
                result: [{ id: "group-20", groupMasterPublicKey: TestUtils.getEmptyPublicKeyString() }],
            }));
            const encryptBytes = jest.spyOn(DocumentCrypto, "encryptBytes");
            encryptBytes.mockReturnValue(futurejs_1.default.of(Buffer.alloc(33)));
            const encryptSpy = jest.spyOn(DocumentCrypto, "encryptPlaintextToUsersAndGroups");
            encryptSpy.mockReturnValue(futurejs_1.default.of({
                userAccessKeys: [{ id: "10", key: encryptedSymKey }],
                groupAccessKeys: [],
                encryptedDocument: Buffer.alloc(55),
            }));
            const docSpy = jest.spyOn(DocumentApi_1.default, "callDocumentCreateApi");
            docSpy.mockReturnValue(futurejs_1.default.of({ id: "bar", created: "1", updated: "2" }));
            DocumentOperations.encryptBytes("doc key", Buffer.from([88, 73, 92]), "", ["user-55", "user-33"], ["user-33"], false).engage((e) => fail(e.message), ({ documentID, documentName, document, created, updated }) => {
                expect(documentID).toEqual("bar");
                expect(documentName).toBeUndefined();
                expect(document).toEqual(Buffer.alloc(33));
                expect(created).toEqual("1");
                expect(updated).toEqual("2");
                const userKeyList = [
                    { id: "user-55", masterPublicKey: TestUtils.getEmptyPublicKeyString() },
                    { id: "user-33", masterPublicKey: TestUtils.getEmptyPublicKeyString() },
                ];
                const groupKeyList = [{ id: "group-20", masterPublicKey: TestUtils.getEmptyPublicKeyString() }];
                expect(DocumentCrypto.encryptBytes).toHaveBeenCalledWith(Utils_1.generateDocumentHeaderBytes("doc key", TestUtils.testSegmentID), Buffer.from([88, 73, 92]), jasmine.any(Buffer));
                expect(DocumentCrypto.encryptPlaintextToUsersAndGroups).toHaveBeenCalledWith(jasmine.any(Buffer), userKeyList, groupKeyList, ApiState_1.default.signingKeys().privateKey);
                expect(DocumentApi_1.default.callDocumentCreateApi).toHaveBeenCalledWith("doc key", [{ id: "10", key: encryptedSymKey }], [], "");
                done();
            });
        });
        test("fails if any of the users or groups cannot be found", (done) => {
            const userSpy = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userSpy.mockReturnValue(futurejs_1.default.of({
                result: [{ id: "user-33", userMasterPublicKey: TestUtils.getEmptyPublicKeyString() }],
            }));
            const groupSpy = jest.spyOn(GroupApi_1.default, "callGroupKeyListApi");
            groupSpy.mockReturnValue(futurejs_1.default.of({
                result: [{ id: "group-20", groupMasterPublicKey: TestUtils.getEmptyPublicKeyString() }],
            }));
            DocumentOperations.encryptBytes("doc key", Buffer.from([88, 73, 92]), "", ["user-33"], ["group-20", "group-33"], true).engage((e) => {
                expect(e.message).toBeString();
                expect(e.message).toContain("[group-33]");
                done();
            }, () => fail("Should not call create when any user or group could not be found"));
        });
        test("fails if no users/groups or author provided to encrypt to", (done) => {
            const userSpy = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            const groupSpy = jest.spyOn(GroupApi_1.default, "callGroupKeyListApi");
            DocumentOperations.encryptBytes("doc key", Buffer.from([88, 73, 92]), "", [], [], false).engage((e) => {
                expect(userSpy).toHaveBeenCalledTimes(1);
                expect(groupSpy).toHaveBeenCalledTimes(1);
                expect(e.message).toContain("No users or groups");
                done();
            }, () => fail("Should not call create when no users/groups were encrypted to"));
        });
    });
    describe("encryptStream", () => {
        test("encrypts document to current user and returns expected document package", () => {
            const encryptedSymKey = TestUtils.getEncryptedSymmetricKey();
            const encryptStreamSpy = jest.spyOn(DocumentCrypto, "encryptStream");
            encryptStreamSpy.mockReturnValue(futurejs_1.default.of(undefined));
            const encryptSpy = jest.spyOn(DocumentCrypto, "encryptPlaintextToUsersAndGroups");
            encryptSpy.mockReturnValue(futurejs_1.default.of({
                userAccessKeys: [{ id: "10", key: encryptedSymKey }],
                groupAccessKeys: [],
            }));
            const apiSpy = jest.spyOn(DocumentApi_1.default, "callDocumentCreateApi");
            apiSpy.mockReturnValue(futurejs_1.default.of({ id: "bar", created: "1", updated: "2" }));
            DocumentOperations.encryptStream("my doc ID", "inputStream", "outputStream", "", [], [], true).engage((e) => fail(e.message), ({ documentID, documentName, created, updated }) => {
                expect(documentID).toEqual("bar");
                expect(documentName).toBeUndefined();
                expect(created).toEqual("1");
                expect(updated).toEqual("2");
                const currentUserRecord = {
                    id: "10",
                    masterPublicKey: TestUtils.accountPublicBytesBase64,
                };
                expect(DocumentCrypto.encryptPlaintextToUsersAndGroups).toHaveBeenCalledWith(jasmine.any(Buffer), [currentUserRecord], [], ApiState_1.default.signingKeys().privateKey);
                expect(DocumentCrypto.encryptStream).toHaveBeenCalledWith(Utils_1.generateDocumentHeaderBytes("my doc ID", TestUtils.testSegmentID), jasmine.any(Buffer), "inputStream", "outputStream");
                expect(DocumentApi_1.default.callDocumentCreateApi).toHaveBeenCalledWith("my doc ID", [{ id: "10", key: encryptedSymKey }], [], "");
            });
        });
        test("sets proper document name when provided", () => {
            const docName = "my doc";
            const encryptedSymKey = TestUtils.getEncryptedSymmetricKey();
            const encryptStreamSpy = jest.spyOn(DocumentCrypto, "encryptStream");
            encryptStreamSpy.mockReturnValue(futurejs_1.default.of(undefined));
            const encryptSpy = jest.spyOn(DocumentCrypto, "encryptPlaintextToUsersAndGroups");
            encryptSpy.mockReturnValue(futurejs_1.default.of({
                userAccessKeys: [{ id: "10", key: encryptedSymKey }],
                groupAccessKeys: [],
            }));
            const apiSpy = jest.spyOn(DocumentApi_1.default, "callDocumentCreateApi");
            apiSpy.mockReturnValue(futurejs_1.default.of({ id: "bar", name: docName, created: "1", updated: "2" }));
            DocumentOperations.encryptStream("my doc ID", "inputStream", "outputStream", docName, [], [], true).engage((e) => fail(e.message), ({ documentID, documentName, created, updated }) => {
                expect(documentID).toEqual("bar");
                expect(documentName).toEqual(docName);
                expect(created).toEqual("1");
                expect(updated).toEqual("2");
            });
        });
        test("encrypts to list of users and groups provided and not author when requested", (done) => {
            const encryptedSymKey = TestUtils.getEncryptedSymmetricKey();
            const userSpy = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userSpy.mockReturnValue(futurejs_1.default.of({
                result: [
                    { id: "user-55", userMasterPublicKey: TestUtils.getEmptyPublicKeyString() },
                    { id: "user-33", userMasterPublicKey: TestUtils.getEmptyPublicKeyString() },
                ],
            }));
            const groupSpy = jest.spyOn(GroupApi_1.default, "callGroupKeyListApi");
            groupSpy.mockReturnValue(futurejs_1.default.of({
                result: [{ id: "group-20", groupMasterPublicKey: TestUtils.getEmptyPublicKeyString() }],
            }));
            const encryptStreamSpy = jest.spyOn(DocumentCrypto, "encryptStream");
            encryptStreamSpy.mockReturnValue(futurejs_1.default.of(undefined));
            const encryptSpy = jest.spyOn(DocumentCrypto, "encryptPlaintextToUsersAndGroups");
            encryptSpy.mockReturnValue(futurejs_1.default.of({
                userAccessKeys: [{ id: "10", key: encryptedSymKey }],
                groupAccessKeys: [],
            }));
            const docSpy = jest.spyOn(DocumentApi_1.default, "callDocumentCreateApi");
            docSpy.mockReturnValue(futurejs_1.default.of({ id: "bar", created: "1", updated: "2" }));
            DocumentOperations.encryptStream("doc key", "inputStream", "outputStream", "", ["user-55", "user-33"], ["user-33"], false).engage((e) => fail(e.message), ({ documentID, documentName, created, updated }) => {
                expect(documentID).toEqual("bar");
                expect(documentName).toBeUndefined();
                expect(created).toEqual("1");
                expect(updated).toEqual("2");
                const userKeyList = [
                    { id: "user-55", masterPublicKey: TestUtils.getEmptyPublicKeyString() },
                    { id: "user-33", masterPublicKey: TestUtils.getEmptyPublicKeyString() },
                ];
                const groupKeyList = [{ id: "group-20", masterPublicKey: TestUtils.getEmptyPublicKeyString() }];
                expect(DocumentCrypto.encryptPlaintextToUsersAndGroups).toHaveBeenCalledWith(jasmine.any(Buffer), userKeyList, groupKeyList, ApiState_1.default.signingKeys().privateKey);
                expect(DocumentCrypto.encryptStream).toHaveBeenCalledWith(Utils_1.generateDocumentHeaderBytes("doc key", TestUtils.testSegmentID), jasmine.any(Buffer), "inputStream", "outputStream");
                expect(DocumentApi_1.default.callDocumentCreateApi).toHaveBeenCalledWith("doc key", [{ id: "10", key: encryptedSymKey }], [], "");
                done();
            });
        });
        test("fails if any of the users or groups cannot be found", (done) => {
            const userSpy = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userSpy.mockReturnValue(futurejs_1.default.of({
                result: [{ id: "user-33", userMasterPublicKey: TestUtils.getEmptyPublicKeyString() }],
            }));
            const groupSpy = jest.spyOn(GroupApi_1.default, "callGroupKeyListApi");
            groupSpy.mockReturnValue(futurejs_1.default.of({
                result: [{ id: "group-20", groupMasterPublicKey: TestUtils.getEmptyPublicKeyString() }],
            }));
            DocumentOperations.encryptStream("doc key", "inputStream", "outputStream", "", ["user-33"], ["group-20", "group-33"], true).engage((e) => {
                expect(e.message).toBeString();
                expect(e.message).toContain("[group-33]");
                done();
            }, () => fail("Should not call create when any user or group could not be found"));
        });
        test("doesnt run encrypt stream if document create call fails", (done) => {
            const docSpy = jest.spyOn(DocumentApi_1.default, "callDocumentCreateApi");
            docSpy.mockReturnValue(futurejs_1.default.reject(new Error("forced request failure")));
            const encryptedSymKey = TestUtils.getEncryptedSymmetricKey();
            const userSpy = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            userSpy.mockReturnValue(futurejs_1.default.of({
                result: [
                    { id: "user-55", userMasterPublicKey: TestUtils.getEmptyPublicKeyString() },
                    { id: "user-33", userMasterPublicKey: TestUtils.getEmptyPublicKeyString() },
                ],
            }));
            const groupSpy = jest.spyOn(GroupApi_1.default, "callGroupKeyListApi");
            groupSpy.mockReturnValue(futurejs_1.default.of({
                result: [{ id: "group-20", groupMasterPublicKey: TestUtils.getEmptyPublicKeyString() }],
            }));
            const encryptStreamSpy = jest.spyOn(DocumentCrypto, "encryptStream");
            encryptStreamSpy.mockReturnValue(futurejs_1.default.of(undefined));
            const encryptSpy = jest.spyOn(DocumentCrypto, "encryptPlaintextToUsersAndGroups");
            encryptSpy.mockReturnValue(futurejs_1.default.of({
                userAccessKeys: [{ id: "10", key: encryptedSymKey }],
                groupAccessKeys: [],
            }));
            DocumentOperations.encryptStream("doc key", "inputStream", "outputStream", "", ["user-55", "user-33"], ["user-33"], false).engage((e) => {
                expect(e.message).toEqual("forced request failure");
                expect(DocumentCrypto.encryptStream).not.toHaveBeenCalled();
                done();
            }, () => fail("Should not succeed when API request fails."));
        });
        test("fails if no users/groups or author provided to encrypt to", (done) => {
            const userSpy = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            const groupSpy = jest.spyOn(GroupApi_1.default, "callGroupKeyListApi");
            DocumentOperations.encryptStream("doc key", "inputStream", "outputStream", "", [], [], false).engage((e) => {
                expect(userSpy).toHaveBeenCalledTimes(1);
                expect(groupSpy).toHaveBeenCalledTimes(1);
                expect(e.message).toContain("No users or groups");
                done();
            }, () => fail("Should not call create when no users/groups were encrypted to"));
        });
    });
    describe("decryptBytes", () => {
        test("fails if provided document isn't a supported version", () => {
            const doc = Buffer.from([8, 35, 235]);
            DocumentOperations.decryptBytes("docID", doc).engage((e) => {
                expect(e.message).toBeString();
                expect(e.code).toEqual(Constants_1.ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE);
            }, () => fail("Should not attempt to decrypt when version isn't valid"));
        });
        test("returns doc in raw bytes", () => {
            const eDoc = Buffer.from([2, 22, 35]);
            const decryptedBytes = Buffer.from([36, 89, 72]);
            const metaGet = jest.spyOn(DocumentApi_1.default, "callDocumentMetadataGetApi");
            metaGet.mockReturnValue(futurejs_1.default.of(TestUtils.getEncryptedDocumentMetaResponse()));
            const decrypt = jest.spyOn(DocumentCrypto, "decryptBytes");
            decrypt.mockReturnValue(futurejs_1.default.of(decryptedBytes));
            DocumentOperations.decryptBytes("docID", eDoc).engage((e) => fail(e.message), ({ data, documentID, documentName, visibleTo, association, created, updated }) => {
                expect(documentID).toEqual("docID");
                expect(documentName).toEqual("my doc");
                expect(association).toEqual("owner");
                expect(created).toEqual("2018-11-28T00:20:16.617Z");
                expect(updated).toEqual("2018-12-04T15:50:01.837Z");
                expect(visibleTo).toEqual({
                    users: [{ id: "user-11" }, { id: "user-33" }],
                    groups: [{ id: "group-34", name: "ICL" }],
                });
                expect(data).toEqual(decryptedBytes);
            });
        });
    });
    describe("decryptStream", () => {
        test("returns doc info", () => {
            const metaGet = jest.spyOn(DocumentApi_1.default, "callDocumentMetadataGetApi");
            metaGet.mockReturnValue(futurejs_1.default.of(TestUtils.getEncryptedDocumentMetaResponse()));
            const decrypt = jest.spyOn(DocumentCrypto, "decryptStream");
            decrypt.mockReturnValue(futurejs_1.default.of(undefined));
            DocumentOperations.decryptStream("docID", "inputStream", "outputFile").engage((e) => fail(e.message), ({ documentID, documentName, visibleTo, association, created, updated }) => {
                expect(documentID).toEqual("docID");
                expect(documentName).toEqual("my doc");
                expect(association).toEqual("owner");
                expect(created).toEqual("2018-11-28T00:20:16.617Z");
                expect(updated).toEqual("2018-12-04T15:50:01.837Z");
                expect(visibleTo).toEqual({
                    users: [{ id: "user-11" }, { id: "user-33" }],
                    groups: [{ id: "group-34", name: "ICL" }],
                });
            });
        });
    });
    describe("updateDocumentBytes", () => {
        test("encrypts new document and returns package", () => {
            const reencrypt = jest.spyOn(DocumentCrypto, "reEncryptBytes");
            reencrypt.mockReturnValue(futurejs_1.default.of(Buffer.alloc(33)));
            const getMeta = jest.spyOn(DocumentApi_1.default, "callDocumentMetadataGetApi");
            getMeta.mockReturnValue(futurejs_1.default.of(TestUtils.getEncryptedDocumentMetaResponse()));
            DocumentOperations.updateDocumentBytes("doc id2", Buffer.from([88, 73, 92])).engage((e) => fail(e.message), ({ documentID, documentName, document, created, updated }) => {
                expect(documentID).toEqual("docID");
                expect(documentName).toEqual("my doc");
                expect(document).toEqual(Buffer.alloc(33));
                expect(created).toEqual("2018-11-28T00:20:16.617Z");
                expect(updated).toEqual("2018-12-04T15:50:01.837Z");
                expect(DocumentCrypto.reEncryptBytes).toHaveBeenCalledWith(Utils_1.generateDocumentHeaderBytes("doc id2", TestUtils.testSegmentID), Buffer.from([88, 73, 92]), TestUtils.getTransformedSymmetricKey(), TestUtils.devicePrivateBytes);
                expect(DocumentApi_1.default.callDocumentMetadataGetApi).toHaveBeenCalledWith("doc id2");
            });
        });
    });
    describe("updateDocumentStream", () => {
        test("encrypts new document and returns meta info", () => {
            const reencrypt = jest.spyOn(DocumentCrypto, "reEncryptStream");
            reencrypt.mockReturnValue(futurejs_1.default.of(undefined));
            const getMeta = jest.spyOn(DocumentApi_1.default, "callDocumentMetadataGetApi");
            getMeta.mockReturnValue(futurejs_1.default.of(TestUtils.getEncryptedDocumentMetaResponse()));
            DocumentOperations.updateDocumentStream("doc id2", "inputStream", "outputStream").engage((e) => fail(e.message), ({ documentID, documentName, created, updated }) => {
                expect(documentID).toEqual("docID");
                expect(documentName).toEqual("my doc");
                expect(created).toEqual("2018-11-28T00:20:16.617Z");
                expect(updated).toEqual("2018-12-04T15:50:01.837Z");
                expect(DocumentCrypto.reEncryptStream).toHaveBeenCalledWith(Utils_1.generateDocumentHeaderBytes("doc id2", TestUtils.testSegmentID), "inputStream", "outputStream", TestUtils.getTransformedSymmetricKey(), TestUtils.devicePrivateBytes);
                expect(DocumentApi_1.default.callDocumentMetadataGetApi).toHaveBeenCalledWith("doc id2");
            });
        });
    });
    describe("updateName", () => {
        test("invokes document update API and maps result subset", () => {
            const updateSpy = jest.spyOn(DocumentApi_1.default, "callDocumentUpdateApi");
            updateSpy.mockReturnValue(futurejs_1.default.of({ id: "bar", name: "updated doc", fromUserId: "user-33", created: "1", updated: "2" }));
            DocumentOperations.updateDocumentName("doc-10", "new name").engage((e) => fail(e.message), (response) => {
                expect(response).toEqual({
                    documentID: "bar",
                    documentName: "updated doc",
                    created: "1",
                    updated: "2",
                });
                expect(DocumentApi_1.default.callDocumentUpdateApi).toHaveBeenCalledWith("doc-10", "new name");
            });
        });
    });
    describe("grantDocumentAccess", () => {
        test("runs all expected API calls and maps results to expected output for list of users", (done) => {
            const userKeys = [{ id: "userID", userMasterPublicKey: { x: "getPublicKey" } }];
            const docSymKey = {
                encryptedSymmetricKey: "esk",
                ephemeralPublicKey: "epk",
                authorizationCode: "ac",
            };
            const keyList = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            keyList.mockReturnValue(futurejs_1.default.of({ result: userKeys }));
            const metaGet = jest.spyOn(DocumentApi_1.default, "callDocumentMetadataGetApi");
            metaGet.mockReturnValue(futurejs_1.default.of({
                encryptedSymmetricKey: docSymKey,
            }));
            const grant = jest.spyOn(DocumentApi_1.default, "callDocumentGrantApi");
            grant.mockReturnValue(futurejs_1.default.of({
                succeededIds: [{ userOrGroup: { type: "user", id: "userID" } }],
                failedIds: [
                    {
                        userOrGroup: { type: "user", id: "userID2" },
                        errorMessage: "failed user",
                    },
                ],
            }));
            const groupKey = jest.spyOn(GroupApi_1.default, "callGroupKeyListApi");
            groupKey.mockReturnValue(futurejs_1.default.of({ result: [] }));
            const encryptToKeys = jest.spyOn(DocumentCrypto, "encryptDocumentToKeys");
            encryptToKeys.mockReturnValue(futurejs_1.default.of({
                userAccessKeys: ["encryptedUserKey"],
                groupAccessKeys: [],
            }));
            DocumentOperations.grantDocumentAccess("docID", ["userID", "userID2"], []).engage((e) => fail(e.message), (data) => {
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
                expect(UserApi_1.default.callUserKeyListApi).toHaveBeenCalledWith(["userID", "userID2"]);
                expect(GroupApi_1.default.callGroupKeyListApi).toHaveBeenCalledWith([]);
                expect(DocumentApi_1.default.callDocumentMetadataGetApi).toHaveBeenCalledWith("docID");
                expect(DocumentCrypto.encryptDocumentToKeys).toHaveBeenCalledWith(docSymKey, [{ id: "userID", masterPublicKey: { x: "getPublicKey" } }], [], TestUtils.devicePrivateBytes, ApiState_1.default.signingKeys().privateKey);
                expect(DocumentApi_1.default.callDocumentGrantApi).toHaveBeenCalledWith("docID", ["encryptedUserKey"], []);
                done();
            });
        });
        test("runs all expected operations and maps result for list of groups", (done) => {
            const groupKeys = [{ id: "groupID", groupMasterPublicKey: { x: "groupPublicKey" }, foo: "bar" }];
            const docSymKey = {
                encryptedSymmetricKey: "esk",
                ephemeralPublicKey: "epk",
                authorizationCode: "ac",
            };
            const user = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            user.mockReturnValue(futurejs_1.default.of({ result: [] }));
            const group = jest.spyOn(GroupApi_1.default, "callGroupKeyListApi");
            group.mockReturnValue(futurejs_1.default.of({ result: groupKeys }));
            const metaGet = jest.spyOn(DocumentApi_1.default, "callDocumentMetadataGetApi");
            metaGet.mockReturnValue(futurejs_1.default.of({
                encryptedSymmetricKey: docSymKey,
            }));
            const grantSpy = jest.spyOn(DocumentApi_1.default, "callDocumentGrantApi");
            grantSpy.mockReturnValue(futurejs_1.default.of({
                succeededIds: [{ userOrGroup: { type: "group", id: "groupID" } }],
                failedIds: [],
            }));
            const encryptToKey = jest.spyOn(DocumentCrypto, "encryptDocumentToKeys");
            encryptToKey.mockReturnValue(futurejs_1.default.of({
                userAccessKeys: [],
                groupAccessKeys: ["encryptedGroupKey"],
            }));
            DocumentOperations.grantDocumentAccess("docID", [], ["groupID"]).engage((e) => fail(e.message), (data) => {
                expect(data).toEqual({
                    succeeded: [
                        {
                            id: "groupID",
                            type: "group",
                        },
                    ],
                    failed: [],
                });
                expect(UserApi_1.default.callUserKeyListApi).toHaveBeenCalledWith([]);
                expect(GroupApi_1.default.callGroupKeyListApi).toHaveBeenCalledWith(["groupID"]);
                expect(DocumentApi_1.default.callDocumentMetadataGetApi).toHaveBeenCalledWith("docID");
                expect(DocumentCrypto.encryptDocumentToKeys).toHaveBeenCalledWith(docSymKey, [], [{ id: "groupID", masterPublicKey: { x: "groupPublicKey" } }], TestUtils.devicePrivateBytes, ApiState_1.default.signingKeys().privateKey);
                expect(DocumentApi_1.default.callDocumentGrantApi).toHaveBeenCalledWith("docID", [], ["encryptedGroupKey"]);
                done();
            });
        });
        test("runs all of the above for lists of users and lists of groups", (done) => {
            const userKeys = [
                { id: "userID1", userMasterPublicKey: { x: "firstuserkey" } },
                { id: "userID2", userMasterPublicKey: { x: "seconduserkey" } },
            ];
            const groupKeys = [
                { id: "groupID1", groupMasterPublicKey: { x: "firstgroupkey" } },
                { id: "groupID2", groupMasterPublicKey: { x: "secondgroupkey" } },
            ];
            const docSymKey = {
                encryptedSymmetricKey: "esk",
                ephemeralPublicKey: "epk",
                authorizationCode: "ac",
            };
            const user = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            user.mockReturnValue(futurejs_1.default.of({ result: userKeys }));
            const group = jest.spyOn(GroupApi_1.default, "callGroupKeyListApi");
            group.mockReturnValue(futurejs_1.default.of({ result: groupKeys }));
            const metaGet = jest.spyOn(DocumentApi_1.default, "callDocumentMetadataGetApi");
            metaGet.mockReturnValue(futurejs_1.default.of({
                encryptedSymmetricKey: docSymKey,
            }));
            const grantSpy = jest.spyOn(DocumentApi_1.default, "callDocumentGrantApi");
            grantSpy.mockReturnValue(futurejs_1.default.of({
                succeededIds: [{ userOrGroup: { type: "group", id: "groupID1" } }, { userOrGroup: { type: "user", id: "userID2" } }],
                failedIds: [
                    { userOrGroup: { type: "group", id: "groupID2" }, errorMessage: "foo" },
                    { userOrGroup: { type: "user", id: "userID1" }, errorMessage: "bar" },
                ],
            }));
            const encryptToKeys = jest.spyOn(DocumentCrypto, "encryptDocumentToKeys");
            encryptToKeys.mockReturnValue(futurejs_1.default.of({
                userAccessKeys: ["encryptedUserKey"],
                groupAccessKeys: ["encryptedGroupKey"],
            }));
            DocumentOperations.grantDocumentAccess("docID", ["userID1", "userID2"], ["groupID1", "groupID2"]).engage((e) => fail(e.message), (data) => {
                expect(data).toEqual({
                    succeeded: [
                        { id: "groupID1", type: "group" },
                        { id: "userID2", type: "user" },
                    ],
                    failed: [
                        { id: "groupID2", type: "group", error: "foo" },
                        { id: "userID1", type: "user", error: "bar" },
                    ],
                });
                expect(UserApi_1.default.callUserKeyListApi).toHaveBeenCalledWith(["userID1", "userID2"]);
                expect(GroupApi_1.default.callGroupKeyListApi).toHaveBeenCalledWith(["groupID1", "groupID2"]);
                expect(DocumentApi_1.default.callDocumentMetadataGetApi).toHaveBeenCalledWith("docID");
                expect(DocumentCrypto.encryptDocumentToKeys).toHaveBeenCalledWith(docSymKey, [
                    { id: "userID1", masterPublicKey: { x: "firstuserkey" } },
                    { id: "userID2", masterPublicKey: { x: "seconduserkey" } },
                ], [
                    { id: "groupID1", masterPublicKey: { x: "firstgroupkey" } },
                    { id: "groupID2", masterPublicKey: { x: "secondgroupkey" } },
                ], TestUtils.devicePrivateBytes, ApiState_1.default.signingKeys().privateKey);
                expect(DocumentApi_1.default.callDocumentGrantApi).toHaveBeenCalledWith("docID", ["encryptedUserKey"], ["encryptedGroupKey"]);
                done();
            });
        });
        test("returns failures for users or groups that dont exist", (done) => {
            const userKeys = [
                { id: "userID1", userMasterPublicKey: { x: "firstuserkey" } },
                { id: "userID2", userMasterPublicKey: { x: "seconduserkey" } },
            ];
            const groupKeys = [{ id: "groupID1", groupMasterPublicKey: { x: "firstgroupkey" } }];
            const docSymKey = {
                encryptedSymmetricKey: "esk",
                ephemeralPublicKey: "epk",
                authorizationCode: "ac",
            };
            const user = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            user.mockReturnValue(futurejs_1.default.of({ result: userKeys }));
            const group = jest.spyOn(GroupApi_1.default, "callGroupKeyListApi");
            group.mockReturnValue(futurejs_1.default.of({ result: groupKeys }));
            const metaGet = jest.spyOn(DocumentApi_1.default, "callDocumentMetadataGetApi");
            metaGet.mockReturnValue(futurejs_1.default.of({
                id: "stored ID",
                encryptedSymmetricKey: docSymKey,
            }));
            const grantSpy = jest.spyOn(DocumentApi_1.default, "callDocumentGrantApi");
            grantSpy.mockReturnValue(futurejs_1.default.of({
                succeededIds: [{ userOrGroup: { type: "group", id: "groupID1" } }, { userOrGroup: { type: "user", id: "userID2" } }],
                failedIds: [
                    { userOrGroup: { type: "group", id: "groupID2" }, errorMessage: "foo" },
                    { userOrGroup: { type: "user", id: "userID1" }, errorMessage: "bar" },
                ],
            }));
            const encryptToKeys = jest.spyOn(DocumentCrypto, "encryptDocumentToKeys");
            encryptToKeys.mockReturnValue(futurejs_1.default.of({
                userAccessKeys: ["encryptedUserKey"],
                groupAccessKeys: ["encryptedGroupKey"],
            }));
            DocumentOperations.grantDocumentAccess("docID", ["userID1", "userID2", "userID3", "userID4"], ["groupID1", "groupID2", "groupID3", "groupID4"]).engage((e) => fail(e.message), (data) => {
                expect(data).toEqual({
                    succeeded: [
                        { id: "groupID1", type: "group" },
                        { id: "userID2", type: "user" },
                    ],
                    failed: [
                        { id: "groupID2", type: "group", error: "foo" },
                        { id: "userID1", type: "user", error: "bar" },
                        { id: "userID3", type: "user", error: "ID did not exist in the system." },
                        { id: "userID4", type: "user", error: "ID did not exist in the system." },
                        { id: "groupID3", type: "group", error: "ID did not exist in the system." },
                        { id: "groupID4", type: "group", error: "ID did not exist in the system." },
                    ],
                });
                expect(UserApi_1.default.callUserKeyListApi).toHaveBeenCalledWith(["userID1", "userID2", "userID3", "userID4"]);
                expect(GroupApi_1.default.callGroupKeyListApi).toHaveBeenCalledWith(["groupID1", "groupID2", "groupID3", "groupID4"]);
                done();
            });
        });
        test("bails early and returns failures when no users or groups can be found", (done) => {
            const user = jest.spyOn(UserApi_1.default, "callUserKeyListApi");
            user.mockReturnValue(futurejs_1.default.of({ result: [] }));
            const group = jest.spyOn(GroupApi_1.default, "callGroupKeyListApi");
            group.mockReturnValue(futurejs_1.default.of({ result: [] }));
            const metaGet = jest.spyOn(DocumentApi_1.default, "callDocumentMetadataGetApi");
            metaGet.mockReturnValue(futurejs_1.default.of({}));
            jest.spyOn(DocumentCrypto, "encryptDocumentToKeys");
            DocumentOperations.grantDocumentAccess("docID", ["userID1", "userID2"], ["groupID1"]).engage((e) => fail(e.message), (data) => {
                expect(data).toEqual({
                    succeeded: [],
                    failed: [
                        { id: "userID1", type: "user", error: "ID did not exist in the system." },
                        { id: "userID2", type: "user", error: "ID did not exist in the system." },
                        { id: "groupID1", type: "group", error: "ID did not exist in the system." },
                    ],
                });
                expect(DocumentCrypto.encryptDocumentToKeys).not.toHaveBeenCalled();
                done();
            });
        });
    });
    describe("revokeDocumentAccess", () => {
        test("calls document revoke API and returns with expected mapped result", () => {
            const revokeApi = jest.spyOn(DocumentApi_1.default, "callDocumentRevokeApi");
            revokeApi.mockReturnValue(futurejs_1.default.of({
                succeededIds: [{ userOrGroup: { type: "group", id: "groupID1" } }, { userOrGroup: { type: "user", id: "userID2" } }],
                failedIds: [
                    { userOrGroup: { type: "group", id: "groupID2" }, errorMessage: "foo" },
                    { userOrGroup: { type: "user", id: "userID1" }, errorMessage: "bar" },
                ],
            }));
            DocumentOperations.revokeDocumentAccess("docID", ["userID1", "userID2"], ["groupID1", "groupID2"]).engage((e) => fail(e.message), (result) => {
                expect(result).toEqual({
                    succeeded: [
                        { id: "groupID1", type: "group" },
                        { id: "userID2", type: "user" },
                    ],
                    failed: [
                        { id: "groupID2", type: "group", error: "foo" },
                        { id: "userID1", type: "user", error: "bar" },
                    ],
                });
            });
        });
    });
});
