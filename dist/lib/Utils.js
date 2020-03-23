"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Constants_1 = require("../Constants");
exports.Codec = {
    Buffer: {
        toBase64(bytes) {
            return bytes.toString("base64");
        },
        fromBase64(bytes) {
            return Buffer.from(bytes, "base64");
        },
        fromTypedArray(bytes) {
            return Buffer.from(bytes.buffer);
        },
    },
    PublicKey: {
        fromBase64(key) {
            return {
                x: exports.Codec.Buffer.fromBase64(key.x),
                y: exports.Codec.Buffer.fromBase64(key.y),
            };
        },
        toBase64(key) {
            return {
                x: exports.Codec.Buffer.toBase64(key.x),
                y: exports.Codec.Buffer.toBase64(key.y),
            };
        },
    },
};
function transformKeyToBase64(transformKey) {
    return {
        ephemeralPublicKey: exports.Codec.PublicKey.toBase64(transformKey.ephemeralPublicKey),
        toPublicKey: exports.Codec.PublicKey.toBase64(transformKey.toPublicKey),
        encryptedTempKey: exports.Codec.Buffer.toBase64(transformKey.encryptedTempKey),
        hashedTempKey: exports.Codec.Buffer.toBase64(transformKey.hashedTempKey),
        publicSigningKey: exports.Codec.Buffer.toBase64(transformKey.publicSigningKey),
        signature: exports.Codec.Buffer.toBase64(transformKey.signature),
    };
}
exports.transformKeyToBase64 = transformKeyToBase64;
function dedupeArray(list, clearEmptyValues = false) {
    const seenList = {};
    return list.filter((item) => {
        if (seenList[item] || (clearEmptyValues && !item.length)) {
            return false;
        }
        seenList[item] = true;
        return true;
    });
}
exports.dedupeArray = dedupeArray;
function validateID(id) {
    if (typeof id !== "string" || !id.length) {
        throw new Error(`Invalid ID provided. Expected a non-zero length string but got ${id}`);
    }
    if (!Constants_1.ALLOWED_ID_CHAR_REGEX.test(id)) {
        throw new Error(`Invalid ID provided. Provided value includes invalid characters: '${id}'.`);
    }
}
exports.validateID = validateID;
function validateDocumentData(data) {
    if (!(data instanceof Buffer) || !data.length) {
        throw new Error(`Invalid document data format provided. Expected a Buffer.`);
    }
}
exports.validateDocumentData = validateDocumentData;
function validateEncryptedDocument(documentData) {
    if (!(documentData instanceof Buffer)) {
        throw new Error(`Invalid encrypted document format provided. Expected a Buffer.`);
    }
    if (documentData.length < Constants_1.VERSION_HEADER_LENGTH + Constants_1.AES_IV_LENGTH + Constants_1.AES_GCM_TAG_LENGTH) {
        throw new Error(`Invalid encrypted document content. Length of content does not meet minimum requirements.`);
    }
}
exports.validateEncryptedDocument = validateEncryptedDocument;
function validateAccessList(accessList) {
    const isUserListSet = accessList && Array.isArray(accessList.users) && accessList.users.length;
    const isGroupListSet = accessList && Array.isArray(accessList.groups) && accessList.groups.length;
    if (!isUserListSet && !isGroupListSet) {
        throw new Error("You must provide a list of users or groups with which to change document access.");
    }
}
exports.validateAccessList = validateAccessList;
function validateIDList(userList) {
    if (!Array.isArray(userList) || !userList.length) {
        throw new Error("You must provide a list of users to perform this operation.");
    }
}
exports.validateIDList = validateIDList;
function dedupeAccessLists(accessList) {
    let userAccess = [];
    let groupAccess = [];
    if (accessList.users && accessList.users.length) {
        userAccess = dedupeArray(accessList.users.map(({ id }) => id), true);
    }
    if (accessList.groups && accessList.groups.length) {
        groupAccess = dedupeArray(accessList.groups.map(({ id }) => id), true);
    }
    return [userAccess, groupAccess];
}
exports.dedupeAccessLists = dedupeAccessLists;
function generateDocumentHeaderBytes(documentID, segmentID) {
    const header = JSON.stringify({
        _did_: documentID,
        _sid_: segmentID,
    });
    const headerDataView = new DataView(new ArrayBuffer(Constants_1.HEADER_META_LENGTH_LENGTH));
    headerDataView.setUint16(0, header.length, false);
    return Buffer.concat([
        Buffer.from([Constants_1.DOCUMENT_ENCRYPTION_DETAILS_VERSION_NUMBER]),
        Buffer.from(headerDataView.buffer),
        Buffer.from(header),
    ]);
}
exports.generateDocumentHeaderBytes = generateDocumentHeaderBytes;
