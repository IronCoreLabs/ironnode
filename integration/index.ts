/* tslint:disable no-console*/
import * as fs from "fs";
import * as inquirer from "inquirer";
import * as path from "path";
import {initializeSDKWithLocalDevice} from "./sdkOperation";
import {askForUserOperation} from "./userOperation";

let hasLocalDevice: boolean;
try {
    fs.accessSync(path.join(__dirname, "./.device.json"));
    hasLocalDevice = true;
} catch (_) {
    hasLocalDevice = false;
}
console.log("\x1Bc");

//If user has a local device, ask if they want to use it. If they don't want to use them or don't have them, ask them user questions
//until they have enough info to initialize the SDK.
if (hasLocalDevice) {
    inquirer
        .prompt<{useDevice: boolean}>({
            type: "list",
            name: "useDevice",
            message: "Local device keys found, use them?",
            choices: [
                {name: "Yes", value: true},
                {name: "No", value: false},
            ],
        })
        .then(({useDevice}) => {
            if (useDevice) {
                return initializeSDKWithLocalDevice();
            }
            return askForUserOperation("Pick a user operation to run.").then(initializeSDKWithLocalDevice);
        })
        .catch((e) => console.error(e));
} else {
    askForUserOperation("No local device found, pick a user operation to run.")
        .then(initializeSDKWithLocalDevice)
        .catch((e) => console.error(e));
}
