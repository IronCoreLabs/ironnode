import * as path from "path";
import * as fs from "fs";
import * as request from "request";
import * as inquirer from "inquirer";
import {SDK} from "../ironnode";
import {log} from "./Logger";

/**
 * Shared list of inquirer questions for document creation
 */
const sharedDocumentQuestions = [
    {
        name: "id",
        type: "input",
        message: "Document ID (optional):",
    },
    {
        name: "name",
        type: "input",
        message: "Document Name (optional):",
    },
    {
        name: "userShares",
        type: "input",
        message: "Comma separated list of users to grant access:",
    },
    {
        name: "groupShares",
        type: "input",
        message: "Comma separated list of groups to grant access:",
    },
];

/**
 * Convert a string of comma separated IDs into an ID list accepted by the SDK
 */
function idListToAccessList(idList: string) {
    if (!idList) {
        return [];
    }
    return idList.split(",").map((id) => ({id: id.trim()}));
}

/**
 * Normalize file path to be relative to this directory
 */
function normalizePath(filePath: string) {
    return path.normalize(path.join(__dirname, filePath));
}

/**
 * Generic method to ask user for file input and output paths with customized messages. Handles filtering, validation, and transforming of
 * data to display fully qualified file paths.
 */
function getFormattedFilePathQuestions(inputMessage: string, outputMessage: string) {
    return [
        {
            name: "inputFile",
            type: "input",
            message: inputMessage,
            transformer: normalizePath,
            filter: normalizePath,
            validate: (filePath: string) => (fs.existsSync(filePath) ? true : `Path to file doesn't exist: ${filePath}`),
        },
        {
            name: "outputFile",
            type: "input",
            message: outputMessage,
            transformer: normalizePath,
            filter: normalizePath,
        },
    ];
}

/**
 * Displays a nicely formatted list of documents the user has access to
 */
function getFormattedDocumentList(IronNode: SDK) {
    return inquirer.prompt<{id: string}>({
        type: "list",
        name: "id",
        message: "What's the ID of the document?",
        pageSize: 10,
        choices: () => {
            return IronNode.document.list().then((documents) => {
                if (documents.result.length === 0) {
                    throw new Error("No documents associated with the current user.");
                }
                const docInfo = documents.result.map((document) => ({
                    name: `${document.documentName} (${document.documentID})`,
                    value: document.documentID,
                }));
                return [...docInfo, new inquirer.Separator()];
            });
        },
    });
}

/**
 * Encrypt a new file given the direct file input from the command line (todo list)
 */
function encryptDirectInput(IronNode: SDK) {
    return inquirer
        .prompt<{data: string; id: string; name: string; userShares: string; groupShares: string}>([
            {
                name: "data",
                type: "input",
                message: "Todo items (comma seperate multiple items):",
            },
            ...sharedDocumentQuestions,
        ])
        .then(({id, name, data, userShares, groupShares}) => {
            const options = {
                documentID: id || undefined,
                documentName: name || undefined,
                accessList: {
                    users: idListToAccessList(userShares),
                    groups: idListToAccessList(groupShares),
                },
            };
            const docData = {
                type: "list",
                content: data.split(",").map((item) => item.trim()),
            };
            return IronNode.document.encryptBytes(Buffer.from(JSON.stringify(docData)), options);
        })
        .then((encryptedDocument) => {
            log({
                ...encryptedDocument,
                "Base64 (not included)": encryptedDocument.document.toString("base64"),
            });
        });
}

/**
 * Update an existing documents bytes by provided new bytes to encrypt.
 */
function updateDirectInput(IronNode: SDK, documentID: string) {
    return inquirer
        .prompt<{data: string}>({
            name: "data",
            type: "input",
            message: "Todo items (comma seperate multiple items):",
        })
        .then(({data}) => {
            const docData = {
                type: "list",
                content: data.split(",").map((item) => item.trim()),
            };
            return IronNode.document.updateEncryptedBytes(documentID, Buffer.from(JSON.stringify(docData)));
        })
        .then(log);
}

/**
 * Decrypt a document by asking for the base64 encoded encrypted document content
 */
function decryptDirectInput(IronNode: SDK, documentID: string) {
    return inquirer
        .prompt<{data: string}>({
            name: "data",
            type: "input",
            message: "Document data (base64 encoded):",
        })
        .then(({data}) => IronNode.document.decryptBytes(documentID, Buffer.from(data, "base64")))
        .then((decryptedDocument) => {
            log({
                ...decryptedDocument,
                "UTF8 (not included)": decryptedDocument.data.toString(),
            });
        });
}

/**
 * Support encrypting the contents of a streaming website. Ask user for URL and location to write file to when complete.
 */
function encryptUrl(IronNode: SDK) {
    return inquirer
        .prompt<{url: string; outputFile: string; id: string; name: string; userShares: string; groupShares: string}>([
            {
                name: "url",
                type: "input",
                message: "What URL do you want to encrypt?",
            },
            {
                name: "outputFile",
                type: "input",
                message: "Path to output file:",
                transformer: normalizePath,
                filter: normalizePath,
            },
            ...sharedDocumentQuestions,
        ])
        .then(({url, outputFile, id, name, userShares, groupShares}) => {
            const options = {
                documentID: id || undefined,
                documentName: name || undefined,
                accessList: {
                    users: idListToAccessList(userShares),
                    groups: idListToAccessList(groupShares),
                },
            };
            return IronNode.document
                .encryptStream(request.get(url) as any, fs.createWriteStream(outputFile), options)
                .then((encryptedDocument) => ({encryptedDocument, outputFile}));
        })
        .then(({encryptedDocument, outputFile}) => {
            log({
                ...encryptedDocument,
                "Encrypted file path (not included)": outputFile,
            });
        });
}

/**
 * Encrypt a file given the path to the input file and the location of where to write the output file
 */
function encryptFile(IronNode: SDK) {
    return inquirer
        .prompt<{inputFile: string; outputFile: string; id: string; name: string; userShares: string; groupShares: string}>([
            ...getFormattedFilePathQuestions("Provide the path to the file to encrypt:", "Provide the path of where to write the output:"),
            ...sharedDocumentQuestions,
        ])
        .then(({id, name, inputFile, outputFile, userShares, groupShares}) => {
            const options = {
                documentID: id || undefined,
                documentName: name || undefined,
                accessList: {
                    users: idListToAccessList(userShares),
                    groups: idListToAccessList(groupShares),
                },
            };
            return IronNode.document
                .encryptStream(fs.createReadStream(inputFile), fs.createWriteStream(outputFile), options)
                .then((encryptedDocument) => ({encryptedDocument, outputFile}));
        })
        .then(({encryptedDocument, outputFile}) => {
            log({
                ...encryptedDocument,
                "Encrypted file path (not included)": outputFile,
            });
        });
}

/**
 * Update an existing encrypted file with a new file.
 */
function updateFile(IronNode: SDK, documentID: string) {
    return inquirer
        .prompt<{inputFile: string; outputFile: string}>(getFormattedFilePathQuestions("Path to encrypted file:", "Path to output file:"))
        .then(({inputFile, outputFile}) => {
            return IronNode.document
                .updateEncryptedStream(documentID, fs.createReadStream(inputFile), fs.createWriteStream(outputFile))
                .then((updatedFile) => ({updatedFile, outputFile}));
        })
        .then(({updatedFile, outputFile}) => {
            log({
                ...updatedFile,
                "Decrypted file path (not included)": outputFile,
            });
        });
}

/**
 * Decrypt a file given the path to it's encrypted file and a location of where to write the decrypted results
 */
function decryptFile(IronNode: SDK, documentID: string) {
    return inquirer
        .prompt<{inputFile: string; outputFile: string}>(getFormattedFilePathQuestions("Path to encrypted file:", "Path to output file:"))
        .then(({inputFile, outputFile}) => {
            if (!fs.existsSync(inputFile)) {
                throw new Error(`Could not find input file path: ${inputFile}`);
            }
            return IronNode.document
                .decryptStream(documentID, fs.createReadStream(inputFile), outputFile)
                .then((encryptedDocument) => ({encryptedDocument, outputFile}));
        })
        .then(({encryptedDocument, outputFile}) => {
            log({
                ...encryptedDocument,
                "Decrypted file path (not included)": outputFile,
            });
        });
}

/**
 * List all document data
 */
export function list(IronNode: SDK) {
    return IronNode.document.list().then(log);
}

/**
 * Get details about a document. Shows the list
 */
export function get(IronNode: SDK) {
    return getFormattedDocumentList(IronNode)
        .then(({id}) => IronNode.document.getMetadata(id))
        .then(log);
}

/**
 * Encrypt a new document. Asks user for ID, name, and users/groups to share with.
 */
export function encryptDocument(IronNode: SDK) {
    return inquirer
        .prompt<{docType: "direct" | "file" | "url"}>({
            name: "docType",
            type: "list",
            message: "What type of document are you encrypting?",
            choices: [{name: "Direct Input", value: "direct"}, {name: "File", value: "file"}, {name: "URL", value: "url"}],
        })
        .then(({docType}) => {
            if (docType === "file") {
                return encryptFile(IronNode);
            }
            if (docType === "url") {
                return encryptUrl(IronNode);
            }
            return encryptDirectInput(IronNode);
        });
}

/**
 * Decrypt a document once a user selects one from their list.
 */
export function decryptDocument(IronNode: SDK) {
    return getFormattedDocumentList(IronNode).then(({id}) => {
        return inquirer
            .prompt<{docType: "file" | "direct"}>({
                name: "docType",
                type: "list",
                message: "What type of document is this?",
                choices: [{name: "Direct Input", value: "direct"}, {name: "File", value: "file"}],
            })
            .then(({docType}) => {
                if (docType === "direct") {
                    return decryptDirectInput(IronNode, id);
                }
                return decryptFile(IronNode, id);
            });
    });
}

/**
 * Update the name of a document to a new name or clear it out
 */
export function updateDocumentName(IronNode: SDK) {
    return getFormattedDocumentList(IronNode).then(({id}) => {
        return inquirer
            .prompt<{name: string}>({
                type: "input",
                name: "name",
                message: "What's the new document name?",
            })
            .then(({name}) => IronNode.document.updateName(id, name === "" ? null : name))
            .then(log);
    });
}

/**
 * Replace the encrypted data within an existing document
 */
export function updateDocumentData(IronNode: SDK) {
    return getFormattedDocumentList(IronNode).then(({id}) => {
        return inquirer
            .prompt<{docType: "file" | "direct"}>({
                name: "docType",
                type: "list",
                message: "What type of document is this?",
                choices: [{name: "Direct Input", value: "direct"}, {name: "File", value: "file"}],
            })
            .then(({docType}) => {
                if (docType === "direct") {
                    return updateDirectInput(IronNode, id);
                }
                return updateFile(IronNode, id);
            });
    });
}

/**
 * Grant access for a document to a list of users or groups
 */
export function grantDocumentAccess(IronNode: SDK) {
    return getFormattedDocumentList(IronNode).then(({id}) => {
        return inquirer
            .prompt<{userShares: string; groupShares: string}>([
                {
                    name: "userShares",
                    type: "input",
                    message: "Comma separated list of users to grant access: ",
                },
                {
                    name: "groupShares",
                    type: "input",
                    message: "Comma separated list of groups to grant access: ",
                },
            ])
            .then(({userShares, groupShares}) => {
                return IronNode.document.grantAccess(id, {
                    users: idListToAccessList(userShares),
                    groups: idListToAccessList(groupShares),
                });
            })
            .then(log);
    });
}

/**
 * Revoke access to a document from a list of users or groups
 */
export function revokeDocumentAccess(IronNode: SDK) {
    return getFormattedDocumentList(IronNode).then(({id}) => {
        return inquirer
            .prompt<{userShares: string; groupShares: string}>([
                {
                    name: "userShares",
                    type: "input",
                    message: "Comma separated list of users to revoke access: ",
                },
                {
                    name: "groupShares",
                    type: "input",
                    message: "Comma separated list of groups to revoke access: ",
                },
            ])
            .then(({userShares, groupShares}) => {
                return IronNode.document.revokeAccess(id, {
                    users: idListToAccessList(userShares),
                    groups: idListToAccessList(groupShares),
                });
            })
            .then(log);
    });
}
