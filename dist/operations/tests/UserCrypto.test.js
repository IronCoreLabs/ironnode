"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const __1 = require("../..");
const Constants_1 = require("../../Constants");
const AES = require("../../crypto/AES");
const Recrypt = require("../../crypto/Recrypt");
const UserCrypto = require("../UserCrypto");
describe("UserCrypto", () => {
    describe("rotateUsersPrivateKey", () => {
        test("decrypts users key, rotates it, the reencrypts the new key", () => {
            jest.spyOn(AES, "decryptUserMasterKey").mockReturnValue(futurejs_1.default.of({
                decryptedPrivateKey: Buffer.from("decryptedPrivateKey"),
                derivedKey: Buffer.from("derivedKey"),
                derivedKeySalt: Buffer.from("derivedKeySalt"),
            }));
            jest.spyOn(AES, "encryptUserMasterKeyWithExistingDerivedKey").mockReturnValue(Buffer.from("encryptedPrivateKey"));
            jest.spyOn(Recrypt, "rotateUsersPrivateKeyWithRetry").mockReturnValue(futurejs_1.default.of({
                newPrivateKey: Buffer.from("rotatedPrivateKey"),
                augmentationFactor: Buffer.from("aug"),
            }));
            UserCrypto.rotateUsersPrivateKey("password", Buffer.from("existingEncryptedKey")).engage((e) => fail(e), ({ newEncryptedPrivateUserKey, augmentationFactor }) => {
                expect(newEncryptedPrivateUserKey).toEqual(Buffer.from("encryptedPrivateKey"));
                expect(augmentationFactor).toEqual(Buffer.from("aug"));
                expect(AES.decryptUserMasterKey).toHaveBeenCalledWith("password", Buffer.from("existingEncryptedKey"));
                expect(AES.encryptUserMasterKeyWithExistingDerivedKey).toHaveBeenCalledWith(Buffer.from("rotatedPrivateKey"), Buffer.from("derivedKey"), Buffer.from("derivedKeySalt"));
                expect(Recrypt.rotateUsersPrivateKeyWithRetry).toHaveBeenCalledWith(Buffer.from("decryptedPrivateKey"));
            });
        });
        test("maps failure to expected SDK error", () => {
            jest.spyOn(AES, "decryptUserMasterKey").mockReturnValue(futurejs_1.default.of({
                decryptedPrivateKey: Buffer.from("decryptedPrivateKey"),
                derivedKey: Buffer.from("derivedKey"),
                derivedKeySalt: Buffer.from("derivedKeySalt"),
            }));
            jest.spyOn(AES, "encryptUserMasterKeyWithExistingDerivedKey").mockReturnValue(Buffer.from("encryptedPrivateKey"));
            jest.spyOn(Recrypt, "rotateUsersPrivateKeyWithRetry").mockReturnValue(futurejs_1.default.reject(new __1.SDKError(new Error("forced failure"), 0)));
            UserCrypto.rotateUsersPrivateKey("password", Buffer.from("key")).engage((e) => {
                expect(e.code).toEqual(Constants_1.ErrorCodes.USER_PRIVATE_KEY_ROTATION_FAILURE);
            }, () => fail("Should not succeed when test fails"));
        });
    });
    describe("reencryptUserMasterPrivateKey", () => {
        test("decrypts, reencrypts provided key", () => {
            jest.spyOn(AES, "decryptUserMasterKey").mockReturnValue(futurejs_1.default.of({ decryptedPrivateKey: Buffer.from("decryptedPrivateKey") }));
            jest.spyOn(AES, "encryptUserMasterKey").mockReturnValue(futurejs_1.default.of(Buffer.from("newEncryptedKey")));
            UserCrypto.reencryptUserMasterPrivateKey(Buffer.from("curEncKey"), "myOldPassword", "newShinyPassword").engage((e) => fail(e), (res) => {
                expect(res).toEqual(Buffer.from("newEncryptedKey"));
                expect(AES.decryptUserMasterKey).toHaveBeenCalledWith("myOldPassword", Buffer.from("curEncKey"));
                expect(AES.encryptUserMasterKey).toHaveBeenCalledWith("newShinyPassword", Buffer.from("decryptedPrivateKey"));
            });
        });
        test("maps error to proper SDK error", () => {
            jest.spyOn(AES, "decryptUserMasterKey").mockReturnValue(futurejs_1.default.reject(new __1.SDKError(new Error("fake"), 222)));
            UserCrypto.reencryptUserMasterPrivateKey(Buffer.from("curEncKey"), "myOldPassword", "newShinyPassword").engage((e) => {
                expect(e.code).toEqual(Constants_1.ErrorCodes.USER_PASSCODE_CHANGE_FAILURE);
            }, () => fail("Should not resolve when decryption fails"));
        });
    });
});
