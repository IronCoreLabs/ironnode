"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const Utils = require("../lib/Utils");
const DocumentOperations = require("../operations/DocumentOperations");
function calculateDocumentCreateOptionsDefault(options) {
    const randomDocID = crypto.randomBytes(16).toString("hex");
    if (!options) {
        return { documentID: randomDocID, documentName: "", grantToAuthor: true, accessList: { users: [], groups: [] } };
    }
    return {
        documentID: options.documentID || randomDocID,
        documentName: options.documentName || "",
        grantToAuthor: options.grantToAuthor !== false,
        accessList: {
            users: options.accessList && options.accessList.users ? options.accessList.users : [],
            groups: options.accessList && options.accessList.groups ? options.accessList.groups : [],
        },
    };
}
function list() {
    return DocumentOperations.list().toPromise();
}
exports.list = list;
function getMetadata(documentID) {
    Utils.validateID(documentID);
    return DocumentOperations.getMetadata(documentID).toPromise();
}
exports.getMetadata = getMetadata;
function getDocumentIDFromBytes(encryptedDocument) {
    Utils.validateEncryptedDocument(encryptedDocument);
    return DocumentOperations.getDocumentIDFromBytes(encryptedDocument).toPromise();
}
exports.getDocumentIDFromBytes = getDocumentIDFromBytes;
function getDocumentIDFromStream(inputStream) {
    return DocumentOperations.getDocumentIDFromStream(inputStream).toPromise();
}
exports.getDocumentIDFromStream = getDocumentIDFromStream;
function decryptBytes(documentID, encryptedDocument) {
    Utils.validateID(documentID);
    Utils.validateEncryptedDocument(encryptedDocument);
    return DocumentOperations.decryptBytes(documentID, encryptedDocument).toPromise();
}
exports.decryptBytes = decryptBytes;
function encryptBytes(documentData, options) {
    Utils.validateDocumentData(documentData);
    const encryptOptions = calculateDocumentCreateOptionsDefault(options);
    if (encryptOptions.documentID) {
        Utils.validateID(encryptOptions.documentID);
    }
    const [userGrants, groupGrants] = Utils.dedupeAccessLists(encryptOptions.accessList);
    return DocumentOperations.encryptBytes(encryptOptions.documentID, documentData, encryptOptions.documentName, userGrants, groupGrants, encryptOptions.grantToAuthor).toPromise();
}
exports.encryptBytes = encryptBytes;
function encryptStream(inputStream, outputStream, options) {
    const encryptOptions = calculateDocumentCreateOptionsDefault(options);
    if (encryptOptions.documentID) {
        Utils.validateID(encryptOptions.documentID);
    }
    const [userGrants, groupGrants] = Utils.dedupeAccessLists(encryptOptions.accessList);
    return DocumentOperations.encryptStream(encryptOptions.documentID, inputStream, outputStream, encryptOptions.documentName, userGrants, groupGrants, encryptOptions.grantToAuthor).toPromise();
}
exports.encryptStream = encryptStream;
function updateEncryptedBytes(documentID, newDocumentData) {
    Utils.validateID(documentID);
    Utils.validateDocumentData(newDocumentData);
    return DocumentOperations.updateDocumentBytes(documentID, newDocumentData).toPromise();
}
exports.updateEncryptedBytes = updateEncryptedBytes;
function updateEncryptedStream(documentID, inputStream, outputStream) {
    Utils.validateID(documentID);
    return DocumentOperations.updateDocumentStream(documentID, inputStream, outputStream).toPromise();
}
exports.updateEncryptedStream = updateEncryptedStream;
function updateName(documentID, name) {
    Utils.validateID(documentID);
    return DocumentOperations.updateDocumentName(documentID, name).toPromise();
}
exports.updateName = updateName;
function grantAccess(documentID, grantList) {
    Utils.validateID(documentID);
    Utils.validateAccessList(grantList);
    const [userGrants, groupGrants] = Utils.dedupeAccessLists(grantList);
    return DocumentOperations.grantDocumentAccess(documentID, userGrants, groupGrants).toPromise();
}
exports.grantAccess = grantAccess;
function revokeAccess(documentID, revokeList) {
    Utils.validateID(documentID);
    Utils.validateAccessList(revokeList);
    const [userRevocations, groupRevocations] = Utils.dedupeAccessLists(revokeList);
    return DocumentOperations.revokeDocumentAccess(documentID, userRevocations, groupRevocations).toPromise();
}
exports.revokeAccess = revokeAccess;
