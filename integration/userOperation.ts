/* tslint:disable no-console*/
import * as fs from "fs";
import * as path from "path";
import * as inquirer from "inquirer";
import * as jwt from "jsonwebtoken";
import {User} from "../src/index";
import {logWithMessage, log} from "./Logger";
// tslint:disable-next-line
const Config = require("./project.json");
const keyFile = path.join(__dirname, "./private.key");
const privateKey = fs.readFileSync(keyFile, "utf8");

/**
 * Generate a signed JWT for the provided user ID.
 */
function generateJWT(userID: string) {
    return jwt.sign({pid: Config.projectId, sid: Config.segmentId, kid: Config.serviceKeyId}, privateKey, {
        algorithm: "ES256",
        expiresIn: "2m",
        subject: userID,
    });
}

/**
 * Ask for a user ID to verify and print the results.
 */
function verifyUser() {
    return inquirer
        .prompt<{userID: string}>({
            type: "input",
            name: "userID",
            message: "Input ID of user to verify: ",
        })
        .then(({userID}) => {
            return User.verify(generateJWT(userID));
        })
        .then((verifyResult) => {
            if (verifyResult) {
                logWithMessage("User Exists!", verifyResult);
            } else {
                log("User does not exist!");
            }
            return Promise.resolve(false);
        });
}

/**
 * Sync a new user within the
 */
function createUser() {
    return inquirer
        .prompt<{userID: string; password: string}>([
            {
                type: "input",
                name: "userID",
                message: "Input ID of user to create: ",
            },
            {
                type: "input",
                name: "password",
                message: "Input password to escrow users private key: ",
            },
        ])
        .then(({userID, password}) => {
            return User.create(generateJWT(userID), password);
        })
        .then((userInfo) => {
            logWithMessage("User Created!", userInfo);
            return Promise.resolve(false);
        });
}

/**
 * Ask for the users ID and password in order to generate them a new set of device keys. If successful write
 * out the device key details into a `.device.json` file in this directory.
 */
function generateLocalDeviceKeys() {
    return inquirer
        .prompt<{userID: string; password: string}>([
            {
                type: "input",
                name: "userID",
                message: "Input ID of user to generate device keys for: ",
            },
            {
                type: "input",
                name: "password",
                message: "Input users private key escrow password: ",
            },
        ])
        .then(({userID, password}) => {
            return User.generateDeviceKeys(generateJWT(userID), password);
        })
        .then((deviceDetails) => {
            fs.writeFileSync(path.join(__dirname, "./.device.json"), JSON.stringify(deviceDetails));
            logWithMessage("New device keys generated and stored locally! SDK now available for use.", deviceDetails);
            return Promise.resolve(true);
        });
}

/**
 * Ask for user related questions so we can (eventually) get device keys stored off to be able to initialize and use
 * the IronNode SDK.
 */
export function askForUserOperation(message: string): Promise<void> {
    return inquirer
        .prompt<{userOperation: "verify" | "createUser" | "createDevice" | "quit"}>({
            type: "list",
            name: "userOperation",
            message,
            choices: [
                {name: "Verify a user", value: "verify"},
                {name: "Create a user", value: "createUser"},
                {name: "Generate device keys for existing user", value: "createDevice"},
                {name: "Quit", value: "quit"},
            ],
        })
        .then(({userOperation}) => {
            if (userOperation === "verify") {
                return verifyUser();
            }
            if (userOperation === "createUser") {
                return createUser();
            }
            if (userOperation === "createDevice") {
                return generateLocalDeviceKeys();
            }
            return process.exit();
        })
        .then((shouldGoIntoSdkOperations) => {
            if (shouldGoIntoSdkOperations) {
                return Promise.resolve();
            }
            return askForUserOperation("Pick a user operation to run.");
        })
        .catch((error) => {
            logWithMessage("User operation failed!", error);
            return askForUserOperation("Pick a user operation to run.");
        });
}
