import Future from "futurejs";
import {SDKError} from "../..";
import {ErrorCodes} from "../../Constants";
import * as AES from "../../crypto/AES";
import * as Recrypt from "../../crypto/Recrypt";
import * as UserCrypto from "../UserCrypto";

describe("UserCrypto", () => {
    describe("rotateUsersPrivateKey", () => {
        test("decrypts users key, rotates it, the reencrypts the new key", () => {
            jest.spyOn(AES, "decryptUserMasterKey").mockReturnValue(
                Future.of({
                    decryptedPrivateKey: Buffer.from("decryptedPrivateKey"),
                    derivedKey: Buffer.from("derivedKey"),
                    derivedKeySalt: Buffer.from("derivedKeySalt"),
                })
            );

            jest.spyOn(AES, "encryptUserMasterKeyWithExistingDerivedKey").mockReturnValue(Buffer.from("encryptedPrivateKey"));
            jest.spyOn(Recrypt, "rotateUsersPrivateKeyWithRetry").mockReturnValue(
                Future.of({
                    newPrivateKey: Buffer.from("rotatedPrivateKey"),
                    augmentationFactor: Buffer.from("aug"),
                })
            );

            UserCrypto.rotateUsersPrivateKey("password", Buffer.from("existingEncryptedKey")).engage(
                (e) => fail(e),
                ({newEncryptedPrivateUserKey, augmentationFactor}) => {
                    expect(newEncryptedPrivateUserKey).toEqual(Buffer.from("encryptedPrivateKey"));
                    expect(augmentationFactor).toEqual(Buffer.from("aug"));

                    expect(AES.decryptUserMasterKey).toHaveBeenCalledWith("password", Buffer.from("existingEncryptedKey"));
                    expect(AES.encryptUserMasterKeyWithExistingDerivedKey).toHaveBeenCalledWith(
                        Buffer.from("rotatedPrivateKey"),
                        Buffer.from("derivedKey"),
                        Buffer.from("derivedKeySalt")
                    );
                    expect(Recrypt.rotateUsersPrivateKeyWithRetry).toHaveBeenCalledWith(Buffer.from("decryptedPrivateKey"));
                }
            );
        });

        test("maps failure to expected SDK error", () => {
            jest.spyOn(AES, "decryptUserMasterKey").mockReturnValue(
                Future.of({
                    decryptedPrivateKey: Buffer.from("decryptedPrivateKey"),
                    derivedKey: Buffer.from("derivedKey"),
                    derivedKeySalt: Buffer.from("derivedKeySalt"),
                })
            );
            jest.spyOn(AES, "encryptUserMasterKeyWithExistingDerivedKey").mockReturnValue(Buffer.from("encryptedPrivateKey"));
            jest.spyOn(Recrypt, "rotateUsersPrivateKeyWithRetry").mockReturnValue(Future.reject(new SDKError(new Error("forced failure"), 0)));

            UserCrypto.rotateUsersPrivateKey("password", Buffer.from("key")).engage(
                (e) => {
                    expect(e.code).toEqual(ErrorCodes.USER_PRIVATE_KEY_ROTATION_FAILURE);
                },
                () => fail("Should not succeed when test fails")
            );
        });
    });
});
