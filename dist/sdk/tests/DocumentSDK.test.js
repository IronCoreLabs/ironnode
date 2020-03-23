"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const DocumentOperations = require("../../operations/DocumentOperations");
const DocumentSDK = require("../DocumentSDK");
describe("DocumentSDK", () => {
    describe("list", () => {
        test("returns Promise invoking document list", (done) => {
            const spy = jest.spyOn(DocumentOperations, "list");
            spy.mockReturnValue(futurejs_1.default.of("list"));
            DocumentSDK.list()
                .then((result) => {
                expect(result).toEqual("list");
                expect(DocumentOperations.list).toHaveBeenCalledWith();
                done();
            })
                .catch((e) => fail(e.message));
        });
    });
    describe("getMetadata", () => {
        test("throws error if document ID is invalid", () => {
            expect(() => DocumentSDK.getMetadata(null)).toThrow();
            expect(() => DocumentSDK.getMetadata("")).toThrow();
            expect(() => DocumentSDK.getMetadata("id,id2")).toThrow();
            expect(() => DocumentSDK.getMetadata("this id")).toThrow();
        });
        test("returns Promise invoking document metadata get", (done) => {
            const spy = jest.spyOn(DocumentOperations, "getMetadata");
            spy.mockReturnValue(futurejs_1.default.of("getmetadata"));
            DocumentSDK.getMetadata("docID")
                .then((result) => {
                expect(result).toEqual("getmetadata");
                expect(DocumentOperations.getMetadata).toHaveBeenCalledWith("docID");
                done();
            })
                .catch((e) => fail(e.message));
        });
    });
    describe("getDocumentIDFromBytes", () => {
        test("fails when encrypted document isnt of the right format", () => {
            expect(() => DocumentSDK.getDocumentIDFromBytes(Buffer.alloc(5))).toThrow();
            expect(() => DocumentSDK.getDocumentIDFromBytes(Buffer.alloc(0))).toThrow();
        });
        test("calls parse ID and returns response", () => {
            const spy = jest.spyOn(DocumentOperations, "getDocumentIDFromBytes");
            spy.mockReturnValue(futurejs_1.default.of("docID"));
            DocumentSDK.getDocumentIDFromBytes(Buffer.alloc(50))
                .then((result) => {
                expect(result).toEqual("docID");
            })
                .catch((e) => fail(e.message));
        });
    });
    describe("getDocumentIDFromStream", () => {
        test("calls parse ID and returns response", () => {
            const spy = jest.spyOn(DocumentOperations, "getDocumentIDFromStream");
            spy.mockReturnValue(futurejs_1.default.of("docID"));
            DocumentSDK.getDocumentIDFromStream("stream")
                .then((result) => {
                expect(result).toEqual("docID");
            })
                .catch((e) => fail(e.message));
        });
    });
    describe("decryptBytes", () => {
        test("throws errors if no document ID or invalid document ID", () => {
            expect(() => DocumentSDK.decryptBytes("", "abc")).toThrow();
            expect(() => DocumentSDK.decryptBytes("<docID>", "abc")).toThrow();
            expect(() => DocumentSDK.decryptBytes("^docID", "abc")).toThrow();
        });
        test("fails when encrypted document isnt of the right format", () => {
            expect(() => DocumentSDK.decryptBytes("id", {})).toThrow();
            expect(() => DocumentSDK.decryptBytes("id", Buffer.alloc(5))).toThrow();
            expect(() => DocumentSDK.decryptBytes("id", Buffer.alloc(0))).toThrow();
        });
        test("calls decrypt bytes api and returns response", (done) => {
            const spy = jest.spyOn(DocumentOperations, "decryptBytes");
            spy.mockReturnValue(futurejs_1.default.of("decryptBytes"));
            DocumentSDK.decryptBytes("mydoc", Buffer.alloc(35))
                .then((result) => {
                expect(result).toEqual("decryptBytes");
                expect(DocumentOperations.decryptBytes).toHaveBeenCalledWith("mydoc", Buffer.alloc(35));
                done();
            })
                .catch((e) => fail(e.message));
        });
    });
    describe("encryptBytes", () => {
        beforeEach(() => {
            const spy = jest.spyOn(DocumentOperations, "encryptBytes");
            spy.mockReturnValue(futurejs_1.default.of("encryptBytes"));
        });
        test("throws errors if arguments are invalid", () => {
            expect(() => DocumentSDK.encryptBytes(Buffer.from([]))).toThrow();
            expect(() => DocumentSDK.encryptBytes(Buffer.from([12]), { documentID: 3 })).toThrow();
            expect(() => DocumentSDK.encryptBytes(Buffer.from([12]), { documentID: "^id3,id2" })).toThrow();
            expect(() => DocumentSDK.encryptBytes(Buffer.from([12]), { documentID: "~id2" })).toThrow();
        });
        test("passes bytes to api and returns response from document create", (done) => {
            DocumentSDK.encryptBytes(Buffer.alloc(32))
                .then((result) => {
                expect(result).toEqual("encryptBytes");
                expect(DocumentOperations.encryptBytes).toHaveBeenCalledWith(jasmine.any(String), Buffer.alloc(32), "", [], [], true);
                const docID = DocumentOperations.encryptBytes.mock.calls[0][0];
                expect(docID).toHaveLength(32);
                expect(docID).toMatch(/[0-9a-fA-F]+/);
                done();
            })
                .catch((e) => fail(e.message));
        });
        test("uses provided ID from options object", (done) => {
            const document = Buffer.from([100, 111, 99]);
            DocumentSDK.encryptBytes(document, { documentID: "providedID" })
                .then((result) => {
                expect(result).toEqual("encryptBytes");
                expect(DocumentOperations.encryptBytes).toHaveBeenCalledWith("providedID", document, "", [], [], true);
                done();
            })
                .catch((e) => fail(e.message));
        });
        test("uses provided name from options object", (done) => {
            const document = Buffer.from([100, 111, 99]);
            DocumentSDK.encryptBytes(document, { documentName: "my doc name" })
                .then((result) => {
                expect(result).toEqual("encryptBytes");
                expect(DocumentOperations.encryptBytes).toHaveBeenCalledWith(jasmine.any(String), document, "my doc name", [], [], true);
                done();
            })
                .catch((e) => fail(e.message));
        });
        test("dedupes list of users and groups provided", (done) => {
            const userList = [{ id: "user-31" }, { id: "user-55" }, { id: "user-31" }];
            const groupList = [{ id: "group-1" }, { id: "group-2" }, { id: "group-3" }];
            const document = Buffer.from([100, 111, 99]);
            DocumentSDK.encryptBytes(document, { accessList: { users: userList, groups: groupList } })
                .then((result) => {
                expect(result).toEqual("encryptBytes");
                expect(DocumentOperations.encryptBytes).toHaveBeenCalledWith(jasmine.any(String), document, "", ["user-31", "user-55"], ["group-1", "group-2", "group-3"], true);
                done();
            })
                .catch((e) => fail(e.message));
        });
        test("passes false for encrypting to current user when provided", (done) => {
            const userList = [{ id: "user-31" }];
            const document = Buffer.from([100, 111, 99]);
            DocumentSDK.encryptBytes(document, { accessList: { users: userList }, grantToAuthor: false })
                .then((result) => {
                expect(result).toEqual("encryptBytes");
                expect(DocumentOperations.encryptBytes).toHaveBeenCalledWith(jasmine.any(String), document, "", ["user-31"], [], false);
                done();
            })
                .catch((e) => fail(e.message));
        });
    });
    describe("encryptStream", () => {
        beforeEach(() => {
            const spy = jest.spyOn(DocumentOperations, "encryptStream");
            spy.mockReturnValue(futurejs_1.default.of("encryptStream"));
        });
        test("throws errors if arguments are invalid", () => {
            expect(() => DocumentSDK.encryptStream("inputStream", "outputStream", { documentID: 3 })).toThrow();
            expect(() => DocumentSDK.encryptStream("inputStream", "outputStream", { documentID: "[ID3]" })).toThrow();
            expect(() => DocumentSDK.encryptStream("inputStream", "outputStream", { documentID: "!ID" })).toThrow();
        });
        test("passes stream to api and returns response from document create", (done) => {
            DocumentSDK.encryptStream("inputStream", "outputStream")
                .then((result) => {
                expect(result).toEqual("encryptStream");
                expect(DocumentOperations.encryptStream).toHaveBeenCalledWith(jasmine.any(String), "inputStream", "outputStream", "", [], [], true);
                done();
            })
                .catch((e) => fail(e.message));
        });
        test("uses provided ID from options object", (done) => {
            DocumentSDK.encryptStream("inputStream", "outputStream", { documentID: "providedID" })
                .then((result) => {
                expect(result).toEqual("encryptStream");
                expect(DocumentOperations.encryptStream).toHaveBeenCalledWith("providedID", "inputStream", "outputStream", "", [], [], true);
                done();
            })
                .catch((e) => fail(e.message));
        });
        test("uses provided name from options object", (done) => {
            DocumentSDK.encryptStream("inputStream", "outputStream", { documentName: "my doc name" })
                .then((result) => {
                expect(result).toEqual("encryptStream");
                expect(DocumentOperations.encryptStream).toHaveBeenCalledWith(jasmine.any(String), "inputStream", "outputStream", "my doc name", [], [], true);
                done();
            })
                .catch((e) => fail(e.message));
        });
        test("dedupes list of users and groups provided", (done) => {
            const userList = [{ id: "user-31" }, { id: "user-55" }, { id: "user-31" }];
            const groupList = [{ id: "group-1" }, { id: "group-2" }, { id: "group-3" }];
            DocumentSDK.encryptStream("inputStream", "outputStream", { accessList: { users: userList, groups: groupList } })
                .then((result) => {
                expect(result).toEqual("encryptStream");
                expect(DocumentOperations.encryptStream).toHaveBeenCalledWith(jasmine.any(String), "inputStream", "outputStream", "", ["user-31", "user-55"], ["group-1", "group-2", "group-3"], true);
                done();
            })
                .catch((e) => fail(e.message));
        });
        test("doesnt encrypt to author when provided", (done) => {
            const userList = [{ id: "user-31" }];
            DocumentSDK.encryptStream("inputStream", "outputStream", { accessList: { users: userList }, grantToAuthor: false })
                .then((result) => {
                expect(result).toEqual("encryptStream");
                expect(DocumentOperations.encryptStream).toHaveBeenCalledWith(jasmine.any(String), "inputStream", "outputStream", "", ["user-31"], [], false);
                done();
            })
                .catch((e) => fail(e.message));
        });
    });
    describe("updateEncryptedBytes", () => {
        test("throws errors for invalid parameters", () => {
            expect(() => DocumentSDK.updateEncryptedBytes("", Buffer.from([]))).toThrow();
            expect(() => DocumentSDK.updateEncryptedBytes("docid", [])).toThrow();
            expect(() => DocumentSDK.updateEncryptedBytes("doc id", [])).toThrow();
            expect(() => DocumentSDK.updateEncryptedBytes(" doc id ", [])).toThrow();
        });
        test("calls updateEncryptedBytes API and returns expected result", (done) => {
            const doc = Buffer.from([100, 111, 99]);
            const spy = jest.spyOn(DocumentOperations, "updateDocumentBytes");
            spy.mockReturnValue(futurejs_1.default.of("updateEncryptedBytes"));
            DocumentSDK.updateEncryptedBytes("mydoc", doc)
                .then((result) => {
                expect(result).toEqual("updateEncryptedBytes");
                expect(DocumentOperations.updateDocumentBytes).toHaveBeenCalledWith("mydoc", doc);
                done();
            })
                .catch((e) => fail(e.message));
        });
    });
    describe("updateEncryptedStream", () => {
        test("throws errors for invalid parameters", () => {
            expect(() => DocumentSDK.updateEncryptedStream("", "inputFile", "outputFile")).toThrow();
            expect(() => DocumentSDK.updateEncryptedStream("doc&id", "inputFile", "outputFile")).toThrow();
        });
        test("calls updateEncryptedStream API and returns expected result", (done) => {
            const spy = jest.spyOn(DocumentOperations, "updateDocumentStream");
            spy.mockReturnValue(futurejs_1.default.of("updateDocumentStream"));
            DocumentSDK.updateEncryptedStream("fileID", "inputFile", "outputFile")
                .then((result) => {
                expect(result).toEqual("updateDocumentStream");
                expect(DocumentOperations.updateDocumentStream).toHaveBeenCalledWith("fileID", "inputFile", "outputFile");
                done();
            })
                .catch((e) => fail(e.message));
        });
    });
    describe("updateName", () => {
        test("throws if ID does not look valid", () => {
            expect(() => DocumentSDK.updateName(null, "")).toThrow();
            expect(() => DocumentSDK.updateName("docID?", "")).toThrow();
        });
        test("calls document update name API with values passed in", (done) => {
            const spy = jest.spyOn(DocumentOperations, "updateDocumentName");
            spy.mockReturnValue(futurejs_1.default.of("updateDocumentName"));
            DocumentSDK.updateName("doc-10", "new name")
                .then((result) => {
                expect(result).toEqual("updateDocumentName");
                expect(DocumentOperations.updateDocumentName).toHaveBeenCalledWith("doc-10", "new name");
                done();
            })
                .catch((e) => fail(e.message));
        });
    });
    describe("grantAccess", () => {
        beforeEach(() => {
            const spy = jest.spyOn(DocumentOperations, "grantDocumentAccess");
            spy.mockReturnValue(futurejs_1.default.of("grantDocumentAccess"));
        });
        test("throws errors if no document ID or ID is invalid", () => {
            expect(() => DocumentSDK.grantAccess("", [])).toThrow();
            expect(() => DocumentSDK.grantAccess("docID^", [])).toThrow();
        });
        test("throws errors if list of user IDs has no valid values", () => {
            expect(() => DocumentSDK.grantAccess("docID", {})).toThrow();
            expect(() => DocumentSDK.grantAccess("docID", { users: [] })).toThrow();
            expect(() => DocumentSDK.grantAccess("docID", { groups: [] })).toThrow();
            expect(() => DocumentSDK.grantAccess("docID", { users: [], groups: [] })).toThrow();
        });
        test("calls document grantAccess API with list of users", (done) => {
            DocumentSDK.grantAccess("mydoc", { users: [{ id: "10" }, { id: "20" }] })
                .then((result) => {
                expect(result).toEqual("grantDocumentAccess");
                expect(DocumentOperations.grantDocumentAccess).toHaveBeenCalledWith("mydoc", ["10", "20"], []);
                done();
            })
                .catch((e) => fail(e.message));
        });
        test("dedupes array of ids provided", (done) => {
            DocumentSDK.grantAccess("mydoc", {
                users: [{ id: "10" }, { id: "20" }, { id: "10" }, { id: "10" }, { id: "20" }],
                groups: [{ id: "35" }, { id: "32" }, { id: "35" }],
            })
                .then((result) => {
                expect(result).toEqual("grantDocumentAccess");
                expect(DocumentOperations.grantDocumentAccess).toHaveBeenCalledWith("mydoc", ["10", "20"], ["35", "32"]);
                done();
            })
                .catch((e) => fail(e.message));
        });
        test("passes in list of valid groups without users as well", (done) => {
            DocumentSDK.grantAccess("mydoc", { groups: [{ id: "35" }, { id: "132" }, { id: "22" }] })
                .then((result) => {
                expect(result).toEqual("grantDocumentAccess");
                expect(DocumentOperations.grantDocumentAccess).toHaveBeenCalledWith("mydoc", [], ["35", "132", "22"]);
                done();
            })
                .catch((e) => fail(e.message));
        });
    });
    describe("revokeAccess", () => {
        beforeEach(() => {
            const spy = jest.spyOn(DocumentOperations, "revokeDocumentAccess");
            spy.mockReturnValue(futurejs_1.default.of("revokeDocumentAccess"));
        });
        test("throws errors if no document ID or invalid", () => {
            expect(() => DocumentSDK.revokeAccess("", [])).toThrow();
            expect(() => DocumentSDK.revokeAccess('"id"', [])).toThrow();
        });
        test("throws errors if list of user IDs has no valid values", () => {
            expect(() => DocumentSDK.revokeAccess("docID", {})).toThrow();
            expect(() => DocumentSDK.revokeAccess("docID", { users: [] })).toThrow();
            expect(() => DocumentSDK.revokeAccess("docID", { groups: [] })).toThrow();
            expect(() => DocumentSDK.revokeAccess("docID", { users: [], groups: [] })).toThrow();
        });
        test("calls document revokeAccess API with list of users", (done) => {
            DocumentSDK.revokeAccess("mydoc", { users: [{ id: "10" }, { id: "20" }] })
                .then((result) => {
                expect(result).toEqual("revokeDocumentAccess");
                expect(DocumentOperations.revokeDocumentAccess).toHaveBeenCalledWith("mydoc", ["10", "20"], []);
                done();
            })
                .catch((e) => fail(e.message));
        });
        test("dedupes array of ids provided", (done) => {
            DocumentSDK.revokeAccess("mydoc", {
                users: [{ id: "10" }, { id: "20" }, { id: "10" }, { id: "10" }, { id: "20" }],
                groups: [{ id: "35" }, { id: "32" }, { id: "35" }],
            })
                .then((result) => {
                expect(result).toEqual("revokeDocumentAccess");
                expect(DocumentOperations.revokeDocumentAccess).toHaveBeenCalledWith("mydoc", ["10", "20"], ["35", "32"]);
                done();
            })
                .catch((e) => fail(e.message));
        });
        test("passes in list of valid groups without users as well", (done) => {
            DocumentSDK.revokeAccess("mydoc", { groups: [{ id: "35" }, { id: "132" }, { id: "22" }] })
                .then((result) => {
                expect(result).toEqual("revokeDocumentAccess");
                expect(DocumentOperations.revokeDocumentAccess).toHaveBeenCalledWith("mydoc", [], ["35", "132", "22"]);
                done();
            })
                .catch((e) => fail(e.message));
        });
    });
});
