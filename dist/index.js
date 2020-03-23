"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Utils = require("./lib/Utils");
const Initialization = require("./sdk/Initialization");
function initialize(accountID, segmentID, privateDeviceKey, privateSigningKey) {
    Utils.validateID(accountID);
    if (typeof segmentID !== "number") {
        throw new Error(`Expected a numerical segment ID but instead got '${segmentID}`);
    }
    if (typeof privateDeviceKey !== "string" || !privateDeviceKey.length || typeof privateSigningKey !== "string" || !privateSigningKey.length) {
        throw new Error("Recieved invalid values for provided private device or signing keys");
    }
    return Initialization.initialize(accountID, segmentID, privateDeviceKey, privateSigningKey).toPromise();
}
exports.initialize = initialize;
exports.User = {
    verify(jwt) {
        return Initialization.userVerify(jwt).toPromise();
    },
    create(jwt, password, options = { needsRotation: false }) {
        return Initialization.createUser(jwt, password, options).toPromise();
    },
    generateDeviceKeys(jwt, password, deviceOptions = { deviceName: "" }) {
        return Initialization.generateDevice(jwt, password, deviceOptions).toPromise();
    },
};
var Constants_1 = require("./Constants");
exports.ErrorCodes = Constants_1.ErrorCodes;
var SDKError_1 = require("./lib/SDKError");
exports.SDKError = SDKError_1.default;
