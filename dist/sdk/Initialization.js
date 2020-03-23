"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const UserApi_1 = require("../api/UserApi");
const Constants_1 = require("../Constants");
const AES_1 = require("../crypto/AES");
const Recrypt = require("../crypto/Recrypt");
const ApiState_1 = require("../lib/ApiState");
const SDKError_1 = require("../lib/SDKError");
const Utils_1 = require("../lib/Utils");
const DocumentSDK = require("./DocumentSDK");
const GroupSDK = require("./GroupSDK");
const UserSDK = require("./UserSDK");
const SDK = {
    document: DocumentSDK,
    group: GroupSDK,
    user: UserSDK,
};
const createNewUser = (jwt, password, options) => Recrypt.generateKeyPair()
    .errorMap((e) => new SDKError_1.default(e, Constants_1.ErrorCodes.USER_MASTER_KEY_GENERATION_FAILURE))
    .flatMap((keypair) => {
    return AES_1.encryptUserMasterKey(password, keypair.privateKey).flatMap((encryptedPrivateKey) => UserApi_1.default.callUserCreateApi(jwt, keypair.publicKey, encryptedPrivateKey, options.needsRotation).map((newUser) => ({
        accountID: newUser.id,
        segmentID: newUser.segmentId,
        userMasterPublicKey: newUser.userMasterPublicKey,
        needsRotation: newUser.needsRotation,
    })));
});
function generateDeviceAndTransformKeys(jwt, userMasterKeyPair) {
    const signingKeyPair = Recrypt.generateEd25519KeyPair();
    return Recrypt.generateKeyPair()
        .flatMap((deviceKeyPair) => {
        return Recrypt.generateTransformKey(userMasterKeyPair.privateKey, deviceKeyPair.publicKey, signingKeyPair.privateKey).map((transformKey) => ({
            signingKeys: signingKeyPair,
            deviceKeys: deviceKeyPair,
            transformKey,
        }));
    })
        .flatMap((deviceKeys) => {
        return Recrypt.generateDeviceAddSignature(jwt, userMasterKeyPair, deviceKeys.transformKey).map((signature) => (Object.assign(Object.assign({}, deviceKeys), { signature })));
    })
        .errorMap((e) => new SDKError_1.default(e, Constants_1.ErrorCodes.USER_DEVICE_KEY_GENERATION_FAILURE));
}
function initialize(accountID, segmentID, privateDeviceKey, privateSigningKey) {
    return UserApi_1.default.getAccountContextPublicKey(accountID, segmentID, privateSigningKey).flatMap((user) => {
        ApiState_1.default.setAccountContext(user.id, segmentID, Utils_1.Codec.PublicKey.fromBase64(user.userMasterPublicKey), Utils_1.Codec.Buffer.fromBase64(user.userPrivateKey), Utils_1.Codec.Buffer.fromBase64(privateDeviceKey), Utils_1.Codec.Buffer.fromBase64(privateSigningKey), user.currentKeyId);
        return futurejs_1.default.of(Object.assign(Object.assign({}, SDK), { userContext: {
                userNeedsRotation: user.needsRotation,
                groupsNeedingRotation: user.groupsNeedingRotation,
            } }));
    });
}
exports.initialize = initialize;
function userVerify(jwt) {
    return UserApi_1.default.callUserVerifyApi(jwt).map((existingUser) => {
        if (!existingUser) {
            return undefined;
        }
        return {
            accountID: existingUser.id,
            segmentID: existingUser.segmentId,
            userMasterPublicKey: existingUser.userMasterPublicKey,
            needsRotation: existingUser.needsRotation,
            groupsNeedingRotation: existingUser.groupsNeedingRotation,
        };
    });
}
exports.userVerify = userVerify;
function createUser(jwt, password, options) {
    return userVerify(jwt).flatMap((user) => (user ? futurejs_1.default.of(user) : createNewUser(jwt, password, options)));
}
exports.createUser = createUser;
function generateDevice(jwt, password, options) {
    return UserApi_1.default.callUserVerifyApi(jwt).flatMap((user) => {
        if (!user) {
            return futurejs_1.default.reject(new SDKError_1.default(new Error("No user exists for the provided ID."), 0));
        }
        return AES_1.decryptUserMasterKey(password, Utils_1.Codec.Buffer.fromBase64(user.userPrivateKey)).flatMap(({ decryptedPrivateKey }) => {
            const userMasterKeyPair = { publicKey: Utils_1.Codec.PublicKey.fromBase64(user.userMasterPublicKey), privateKey: decryptedPrivateKey };
            return generateDeviceAndTransformKeys(jwt, userMasterKeyPair).flatMap((deviceAdd) => UserApi_1.default.callUserDeviceAdd(jwt, userMasterKeyPair.publicKey, deviceAdd.transformKey, deviceAdd.signature.signature, deviceAdd.signature.ts, options).map(() => ({
                accountID: user.id,
                segmentID: user.segmentId,
                deviceKeys: {
                    publicKey: Utils_1.Codec.PublicKey.toBase64(deviceAdd.deviceKeys.publicKey),
                    privateKey: Utils_1.Codec.Buffer.toBase64(deviceAdd.deviceKeys.privateKey),
                },
                signingKeys: {
                    publicKey: Utils_1.Codec.Buffer.toBase64(deviceAdd.signingKeys.publicKey),
                    privateKey: Utils_1.Codec.Buffer.toBase64(deviceAdd.signingKeys.privateKey),
                },
            })));
        });
    });
}
exports.generateDevice = generateDevice;
