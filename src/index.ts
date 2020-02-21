import {DeviceCreateOptions, UserCreateOptions} from "../ironnode";
import {Base64String} from "./commonTypes";
import * as Utils from "./lib/Utils";
import * as Initialization from "./sdk/Initialization";

/**
 * Initialize the Node SDK by providing account information necessary to run operations from a server side context. Returns a Promise which
 * will resolve with the IronWeb Node SDK object.
 * @param {string}       accountID         ID of the account to perform actions as
 * @param {number}       segmentID         Internal segment ID the account is part of
 * @param {Base64String} privateDeviceKey  Base64 encoded device key bytes associated to the account in use
 * @param {Base64String} privateSigningKey Base64 encoded signing key bytes associated to the account in use
 */
export function initialize(accountID: string, segmentID: number, privateDeviceKey: Base64String, privateSigningKey: Base64String) {
    Utils.validateID(accountID);
    if (typeof segmentID !== "number") {
        throw new Error(`Expected a numerical segment ID but instead got '${segmentID}`);
    }
    if (typeof privateDeviceKey !== "string" || !privateDeviceKey.length || typeof privateSigningKey !== "string" || !privateSigningKey.length) {
        throw new Error("Recieved invalid values for provided private device or signing keys");
    }
    return Initialization.initialize(accountID, segmentID, privateDeviceKey, privateSigningKey).toPromise();
}

export const User = {
    /**
     * Check to see if the user within the provided signed JWT exists within IronCore. Returns a Promise which will resolve with either a user
     * object or undefined if the user doesn't exist.
     * @param {string} jwt Signed JWT for the user to check
     */
    verify(jwt: string) {
        return Initialization.userVerify(jwt).toPromise();
    },
    /**
     * Sync a user within the IronCore system. Uses the ID contained within the provided signed JWT and escrows the users private key using the
     * provided password.
     * @param {string} jwt      Signed JWT for the user to sync
     * @param {string} password Password to use to escrow the users private key
     * @param {UserCreateOptions} options Optional options when creating a new user.
     */
    create(jwt: string, password: string, options: UserCreateOptions = {needsRotation: false}) {
        return Initialization.createUser(jwt, password, options).toPromise();
    },
    /**
     * Generate a new pair of device keys for the user specified in the provided signed JWT. Takes the users password in order to decrypt their master
     * keys and generates a new device key pair as well as a transform key between their master key pair and their device key pair. Returns both the
     * device key pair and a signing key pair as base64 encoded strings as well as the users ID and the segment ID for the user. All of these fields can
     * then be stored somewhere secure and passed in to run the `initialize` function in order for the current user to interact with the SDK. Also allows
     * the call to provide a readable "name" for this device.
     * @param {string}              jwt      Signed JWT for the user to sync
     * @param {string}              password Password to use to escrow the users private key
     * @param {DeviceCreateOptions} options  Device create options.
     */
    generateDeviceKeys(jwt: string, password: string, deviceOptions: DeviceCreateOptions = {deviceName: ""}) {
        return Initialization.generateDevice(jwt, password, deviceOptions).toPromise();
    },
};

/**
 * List of SDK Error Codes
 */
export {ErrorCodes} from "./Constants";
/**
 * SDK Error which extends normal Error object but adds `code` property which will be one of the ErrorCodes from above
 */
export {default as SDKError} from "./lib/SDKError";
