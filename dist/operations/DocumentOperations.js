"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const DocumentApi_1 = require("../api/DocumentApi");
const GroupApi_1 = require("../api/GroupApi");
const UserApi_1 = require("../api/UserApi");
const Constants_1 = require("../Constants");
const ApiState_1 = require("../lib/ApiState");
const SDKError_1 = require("../lib/SDKError");
const Utils_1 = require("../lib/Utils");
const DocumentCrypto = require("./DocumentCrypto");
const getKeyListsForUsersAndGroups = (userGrants, groupGrants, encryptToAuthor) => {
    const { accountID } = ApiState_1.default.accountAndSegmentIDs();
    return futurejs_1.default.gather2(UserApi_1.default.callUserKeyListApi(userGrants), GroupApi_1.default.callGroupKeyListApi(groupGrants)).flatMap(([userKeys, groupKeys]) => {
        if (userKeys.result.length !== userGrants.length || groupKeys.result.length !== groupGrants.length) {
            const existingUserIDs = userKeys.result.map(({ id }) => id);
            const existingGroupIDs = groupKeys.result.map(({ id }) => id);
            const missingUsers = userGrants.filter((userID) => existingUserIDs.indexOf(userID) === -1).join(",");
            const missingGroups = groupGrants.filter((groupID) => existingGroupIDs.indexOf(groupID) === -1).join(",");
            return futurejs_1.default.reject(new SDKError_1.default(new Error(`Failed to create document due to unknown users or groups in access list. Missing user IDs: [${missingUsers}]. Missing group IDs: [${missingGroups}]`), Constants_1.ErrorCodes.DOCUMENT_CREATE_WITH_ACCESS_FAILURE));
        }
        const currentUser = encryptToAuthor ? [{ id: accountID, userMasterPublicKey: Utils_1.Codec.PublicKey.toBase64(ApiState_1.default.accountPublicKey()) }] : [];
        if (groupKeys.result.length === 0 && userKeys.result.length === 0 && currentUser.length === 0) {
            return futurejs_1.default.reject(new SDKError_1.default(new Error("No users or groups were provided to encrypt document to."), Constants_1.ErrorCodes.DOCUMENT_ENCRYPT_FAILURE));
        }
        return futurejs_1.default.of({
            userKeys: { result: [...userKeys.result, ...currentUser] },
            groupKeys,
        });
    });
};
const normalizeUserAndGroupPublicKeyList = (userKeys, groupKeys) => [
    userKeys.result.map((user) => ({ id: user.id, masterPublicKey: user.userMasterPublicKey })),
    groupKeys.result.map((group) => ({ id: group.id, masterPublicKey: group.groupMasterPublicKey })),
];
const accessResultToAccessResponse = (succeededIDs, failedIDs) => ({
    succeeded: succeededIDs.map(({ userOrGroup }) => ({
        id: userOrGroup.id,
        type: userOrGroup.type,
    })),
    failed: failedIDs.map(({ userOrGroup, errorMessage }) => ({
        id: userOrGroup.id,
        type: userOrGroup.type,
        error: errorMessage,
    })),
});
const missingEntitiesToFailures = (entityList, successfulList, failureList, type) => {
    const matches = (id, { userOrGroup }) => userOrGroup.type === type && userOrGroup.id === id;
    return entityList
        .filter((id) => {
        const doesMatch = matches.bind(null, id);
        return !successfulList.some(doesMatch) && !failureList.some(doesMatch);
    })
        .map((id) => ({
        id,
        type,
        error: "ID did not exist in the system.",
    }));
};
const accessResponseToSDKResult = (accessChangeResult, requestedUserAccess, requestedGroupAccess) => {
    const missingUsers = missingEntitiesToFailures(requestedUserAccess, accessChangeResult.succeededIds, accessChangeResult.failedIds, Constants_1.UserAndGroupTypes.USER);
    const missingGroups = missingEntitiesToFailures(requestedGroupAccess, accessChangeResult.succeededIds, accessChangeResult.failedIds, Constants_1.UserAndGroupTypes.GROUP);
    const mappedResults = accessResultToAccessResponse(accessChangeResult.succeededIds, accessChangeResult.failedIds);
    mappedResults.failed = mappedResults.failed.concat(missingUsers).concat(missingGroups);
    return mappedResults;
};
function list() {
    return DocumentApi_1.default.callDocumentListApi().map(({ result }) => {
        return {
            result: result.map((document) => ({
                documentID: document.id,
                documentName: document.name,
                association: document.association.type,
                created: document.created,
                updated: document.updated,
            })),
        };
    });
}
exports.list = list;
function getMetadata(documentID) {
    return DocumentApi_1.default.callDocumentMetadataGetApi(documentID).map((docMeta) => ({
        documentID: docMeta.id,
        documentName: docMeta.name,
        association: docMeta.association.type,
        visibleTo: docMeta.visibleTo,
        created: docMeta.created,
        updated: docMeta.updated,
    }));
}
exports.getMetadata = getMetadata;
function getDocumentIDFromBytes(encryptedDocument) {
    if (encryptedDocument[0] === 1) {
        return futurejs_1.default.of(null);
    }
    if (encryptedDocument[0] !== 2) {
        return futurejs_1.default.reject(new SDKError_1.default(new Error("File is not a supported version and may not be an encrypted file."), Constants_1.ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE));
    }
    const headerLength = encryptedDocument.readUInt16BE(Constants_1.VERSION_HEADER_LENGTH);
    const headerString = encryptedDocument
        .slice(Constants_1.VERSION_HEADER_LENGTH + Constants_1.HEADER_META_LENGTH_LENGTH, Constants_1.VERSION_HEADER_LENGTH + Constants_1.HEADER_META_LENGTH_LENGTH + headerLength)
        .toString();
    try {
        const data = JSON.parse(headerString);
        return futurejs_1.default.of(data._did_);
    }
    catch (_) {
        return futurejs_1.default.reject(new SDKError_1.default(new Error("Unable to parse document header. Header value is corrupted."), Constants_1.ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE));
    }
}
exports.getDocumentIDFromBytes = getDocumentIDFromBytes;
function getDocumentIDFromStream(inputStream) {
    return new futurejs_1.default((reject, resolve) => {
        let hasRead = false;
        inputStream.on("readable", () => {
            if (hasRead) {
                return;
            }
            hasRead = true;
            const versionAndHeader = inputStream.read(Constants_1.VERSION_HEADER_LENGTH + Constants_1.HEADER_META_LENGTH_LENGTH);
            if (!versionAndHeader) {
                return reject(new SDKError_1.default(new Error("Was not able to read from file."), Constants_1.ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE));
            }
            if (versionAndHeader[0] === 1) {
                return resolve(null);
            }
            if (versionAndHeader[0] !== 2) {
                return reject(new SDKError_1.default(new Error("File is not a supported version and may not be an encrypted file."), Constants_1.ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE));
            }
            const versionHeaderLength = versionAndHeader.readUInt16BE(Constants_1.VERSION_HEADER_LENGTH);
            const headerBytes = inputStream.read(versionHeaderLength);
            if (!headerBytes || headerBytes.length < versionHeaderLength) {
                return reject(new SDKError_1.default(new Error("Was not able to read from file or file is corrupted."), Constants_1.ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE));
            }
            try {
                const headerData = JSON.parse(headerBytes.toString());
                resolve(headerData._did_);
            }
            catch (_) {
                reject(new SDKError_1.default(new Error("File header could not be parsed."), Constants_1.ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE));
            }
        });
    });
}
exports.getDocumentIDFromStream = getDocumentIDFromStream;
function encryptBytes(documentID, document, documentName, userGrants, groupGrants, encryptToAuthor) {
    return futurejs_1.default.gather2(getKeyListsForUsersAndGroups(userGrants, groupGrants, encryptToAuthor), DocumentCrypto.generateDocumentKeys())
        .flatMap(([{ userKeys, groupKeys }, { documentPlaintext, documentSymmetricKey }]) => {
        const [userPublicKeys, groupPublicKeys] = normalizeUserAndGroupPublicKeyList(userKeys, groupKeys);
        const documentHeader = Utils_1.generateDocumentHeaderBytes(documentID, ApiState_1.default.accountAndSegmentIDs().segmentID);
        return futurejs_1.default.gather2(DocumentCrypto.encryptPlaintextToUsersAndGroups(documentPlaintext, userPublicKeys, groupPublicKeys, ApiState_1.default.signingKeys().privateKey), DocumentCrypto.encryptBytes(documentHeader, document, documentSymmetricKey));
    })
        .flatMap(([createPayload, encryptedDocument]) => {
        return DocumentApi_1.default.callDocumentCreateApi(documentID, createPayload.userAccessKeys, createPayload.groupAccessKeys, documentName).map((createdDocument) => ({
            createdDocument,
            encryptedDocument,
        }));
    })
        .map(({ createdDocument, encryptedDocument }) => ({
        documentID: createdDocument.id,
        documentName: createdDocument.name,
        document: encryptedDocument,
        created: createdDocument.created,
        updated: createdDocument.updated,
    }));
}
exports.encryptBytes = encryptBytes;
function encryptStream(documentID, inputStream, outputStream, documentName, userGrants, groupGrants, encryptToAuthor) {
    return futurejs_1.default.gather2(getKeyListsForUsersAndGroups(userGrants, groupGrants, encryptToAuthor), DocumentCrypto.generateDocumentKeys())
        .flatMap(([{ userKeys, groupKeys }, { documentPlaintext, documentSymmetricKey }]) => {
        const [userPublicKeys, groupPublicKeys] = normalizeUserAndGroupPublicKeyList(userKeys, groupKeys);
        return DocumentCrypto.encryptPlaintextToUsersAndGroups(documentPlaintext, userPublicKeys, groupPublicKeys, ApiState_1.default.signingKeys().privateKey).map((createPayload) => ({
            createPayload,
            documentSymmetricKey,
        }));
    })
        .flatMap(({ createPayload, documentSymmetricKey }) => {
        return DocumentApi_1.default.callDocumentCreateApi(documentID, createPayload.userAccessKeys, createPayload.groupAccessKeys, documentName).map((createdDocument) => ({ createdDocument, documentSymmetricKey }));
    })
        .flatMap(({ createdDocument, documentSymmetricKey }) => {
        const documentHeader = Utils_1.generateDocumentHeaderBytes(documentID, ApiState_1.default.accountAndSegmentIDs().segmentID);
        return DocumentCrypto.encryptStream(documentHeader, documentSymmetricKey, inputStream, outputStream).map(() => ({
            documentID: createdDocument.id,
            documentName: createdDocument.name,
            created: createdDocument.created,
            updated: createdDocument.updated,
        }));
    });
}
exports.encryptStream = encryptStream;
function decryptBytes(documentID, encryptedDocument) {
    if (encryptedDocument[0] !== 1 && encryptedDocument[0] !== 2) {
        return futurejs_1.default.reject(new SDKError_1.default(new Error("Provided encrypted document doesn't appear to be valid. Invalid version."), Constants_1.ErrorCodes.DOCUMENT_HEADER_PARSE_FAILURE));
    }
    return DocumentApi_1.default.callDocumentMetadataGetApi(documentID).flatMap((documentResponse) => {
        console.log(`DocumentGet response: ${JSON.stringify(documentResponse)}`);
        return DocumentCrypto.decryptBytes(encryptedDocument, documentResponse.encryptedSymmetricKey, ApiState_1.default.devicePrivateKey()).map((decryptedDocument) => ({
            documentID,
            documentName: documentResponse.name,
            visibleTo: documentResponse.visibleTo,
            data: decryptedDocument,
            association: documentResponse.association.type,
            created: documentResponse.created,
            updated: documentResponse.updated,
        }));
    });
}
exports.decryptBytes = decryptBytes;
function decryptStream(documentID, encryptedWriteStream, outFile) {
    return DocumentApi_1.default.callDocumentMetadataGetApi(documentID).flatMap((documentResponse) => {
        return DocumentCrypto.decryptStream(encryptedWriteStream, outFile, documentResponse.encryptedSymmetricKey, ApiState_1.default.devicePrivateKey()).map(() => ({
            documentID,
            documentName: documentResponse.name,
            visibleTo: documentResponse.visibleTo,
            association: documentResponse.association.type,
            created: documentResponse.created,
            updated: documentResponse.updated,
        }));
    });
}
exports.decryptStream = decryptStream;
function updateDocumentBytes(documentID, newDocumentData) {
    return DocumentApi_1.default.callDocumentMetadataGetApi(documentID)
        .flatMap((documentResponse) => {
        const documentHeader = Utils_1.generateDocumentHeaderBytes(documentID, ApiState_1.default.accountAndSegmentIDs().segmentID);
        return DocumentCrypto.reEncryptBytes(documentHeader, newDocumentData, documentResponse.encryptedSymmetricKey, ApiState_1.default.devicePrivateKey()).map((updatedDoc) => ({
            updatedDoc,
            documentResponse,
        }));
    })
        .map(({ updatedDoc, documentResponse }) => ({
        documentID: documentResponse.id,
        documentName: documentResponse.name,
        document: updatedDoc,
        created: documentResponse.created,
        updated: documentResponse.updated,
    }));
}
exports.updateDocumentBytes = updateDocumentBytes;
function updateDocumentStream(documentID, inputStream, outputStream) {
    return DocumentApi_1.default.callDocumentMetadataGetApi(documentID).flatMap((documentResponse) => {
        const documentHeader = Utils_1.generateDocumentHeaderBytes(documentID, ApiState_1.default.accountAndSegmentIDs().segmentID);
        return DocumentCrypto.reEncryptStream(documentHeader, inputStream, outputStream, documentResponse.encryptedSymmetricKey, ApiState_1.default.devicePrivateKey()).map(() => ({
            documentID: documentResponse.id,
            documentName: documentResponse.name,
            created: documentResponse.created,
            updated: documentResponse.updated,
        }));
    });
}
exports.updateDocumentStream = updateDocumentStream;
function updateDocumentName(documentID, documentName) {
    return DocumentApi_1.default.callDocumentUpdateApi(documentID, documentName).map((updatedDocument) => ({
        documentID: updatedDocument.id,
        documentName: updatedDocument.name,
        created: updatedDocument.created,
        updated: updatedDocument.updated,
    }));
}
exports.updateDocumentName = updateDocumentName;
function grantDocumentAccess(documentID, userGrants, groupGrants) {
    return futurejs_1.default.gather3(UserApi_1.default.callUserKeyListApi(userGrants), GroupApi_1.default.callGroupKeyListApi(groupGrants), DocumentApi_1.default.callDocumentMetadataGetApi(documentID)).flatMap(([userKeys, groupKeys, documentMetadata]) => {
        if (!userKeys.result.length && !groupKeys.result.length) {
            return futurejs_1.default.of(accessResponseToSDKResult({ succeededIds: [], failedIds: [] }, userGrants, groupGrants));
        }
        const [userPublicKeys, groupPublicKeys] = normalizeUserAndGroupPublicKeyList(userKeys, groupKeys);
        return DocumentCrypto.encryptDocumentToKeys(documentMetadata.encryptedSymmetricKey, userPublicKeys, groupPublicKeys, ApiState_1.default.devicePrivateKey(), ApiState_1.default.signingKeys().privateKey)
            .flatMap((encryptedKeys) => DocumentApi_1.default.callDocumentGrantApi(documentID, encryptedKeys.userAccessKeys, encryptedKeys.groupAccessKeys))
            .map((accessResult) => accessResponseToSDKResult(accessResult, userGrants, groupGrants));
    });
}
exports.grantDocumentAccess = grantDocumentAccess;
function revokeDocumentAccess(documentID, userRevocations, groupRevocations) {
    return DocumentApi_1.default.callDocumentRevokeApi(documentID, userRevocations, groupRevocations).map(({ succeededIds, failedIds }) => accessResultToAccessResponse(succeededIds, failedIds));
}
exports.revokeDocumentAccess = revokeDocumentAccess;
