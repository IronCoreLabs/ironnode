/* tslint:disable no-console cyclomatic-complexity*/
import * as path from "path";
import * as inquirer from "inquirer";
import {initialize} from "../src/index";
import * as Documents from "./Documents";
import * as Groups from "./Groups";
import * as Users from "./Users";
import {SDK} from "../ironnode";

const topLevelPrompt = {
    type: "list",
    name: "operation",
    message: "Which operation do you want to run?",
    pageSize: 25,
    choices: [
        {name: "Document List", value: "docList"},
        {name: "Document Get", value: "docGet"},
        {name: "Document Parse ID", value: "docParse"},
        {name: "Document Decrypt", value: "docDecrypt"},
        {name: "Document Encrypt", value: "docEncrypt"},
        {name: "Update Document Data", value: "docUpdateData"},
        {name: "Update Document Name", value: "docUpdateName"},
        {name: "Grant Document Access", value: "docGrant"},
        {name: "Revoke Document Access", value: "docRevoke"},
        new inquirer.Separator(),
        {name: "Group List", value: "groupList"},
        {name: "Group Get", value: "groupGet"},
        {name: "Group Create", value: "groupCreate"},
        {name: "Group Update", value: "groupUpdate"},
        {name: "Group Add Admins", value: "groupAddAdmins"},
        {name: "Group Remove Admins", value: "groupRemoveAdmins"},
        {name: "Group Add Members", value: "groupAddMembers"},
        {name: "Group Remove Members", value: "groupRemoveMembers"},
        {name: "Group Delete", value: "groupDelete"},
        new inquirer.Separator(),
        {name: "User Public Key Lookup", value: "userKeyLookup"},
        {name: "User Device List", value: "userDeviceList"},
        {name: "User Device Delete", value: "userDeviceDelete"},
        new inquirer.Separator(),
        {name: "Quit", value: "quit"},
        new inquirer.Separator(),
    ],
};

/**
 * Route the top level prompt to the correct operation.
 */
function routeAnswerToOperation(IronNode: SDK, answer: string) {
    switch (answer) {
        case "docList":
            return Documents.list(IronNode);
        case "docGet":
            return Documents.get(IronNode);
        case "docParse":
            return Documents.parseID(IronNode);
        case "docEncrypt":
            return Documents.encryptDocument(IronNode);
        case "docDecrypt":
            return Documents.decryptDocument(IronNode);
        case "docUpdateName":
            return Documents.updateDocumentName(IronNode);
        case "docUpdateData":
            return Documents.updateDocumentData(IronNode);
        case "docGrant":
            return Documents.grantDocumentAccess(IronNode);
        case "docRevoke":
            return Documents.revokeDocumentAccess(IronNode);
        case "groupList":
            return Groups.list(IronNode);
        case "groupGet":
            return Groups.get(IronNode);
        case "groupCreate":
            return Groups.create(IronNode);
        case "groupUpdate":
            return Groups.update(IronNode);
        case "groupAddAdmins":
            return Groups.addAdmins(IronNode);
        case "groupRemoveAdmins":
            return Groups.removeAdmins(IronNode);
        case "groupAddMembers":
            return Groups.addMembers(IronNode);
        case "groupRemoveMembers":
            return Groups.removeMembers(IronNode);
        case "groupDelete":
            return Groups.deleteGroup(IronNode);
        case "userKeyLookup":
            return Users.publicKeyLookup(IronNode);
        case "userDeviceList":
            return Users.deviceList(IronNode);
        case "userDeviceDelete":
            return Users.deviceDelete(IronNode);
        case "quit":
            return process.exit();
        default:
            console.error("Method not yet implemented!");
            return process.exit(-1);
    }
}

/**
 * Ask the top level question about which operation to run. If it fails log the error. In both cases, recursively
 * show the top level operation prompt again.
 */
function askForOperation(IronNode: SDK) {
    return inquirer
        .prompt<{operation: string}>(topLevelPrompt)
        .then(({operation}) => {
            return routeAnswerToOperation(IronNode, operation).catch((error) => {
                console.log("\x1Bc");
                console.error(`${error.message}\n\n`);
                //Even if an error occurs, recover and go back to the operation list
                return Promise.resolve();
            });
        })
        .then(() => {
            askForOperation(IronNode);
        });
}

export function initializeSDKWithLocalDevice() {
    const Config = require(path.join(__dirname, "./.device.json"));
    return initialize(Config.accountID, Config.segmentID, Config.deviceKeys.privateKey, Config.signingKeys.privateKey)
        .then((IronNode) => askForOperation(IronNode))
        .catch((error) => console.error(`SDK Initialization Error: ${error.message}`));
}
