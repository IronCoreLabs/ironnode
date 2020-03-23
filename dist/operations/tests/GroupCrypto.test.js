"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const futurejs_1 = require("futurejs");
const Constants_1 = require("../../Constants");
const Recrypt = require("../../crypto/Recrypt");
const TestUtils = require("../../tests/TestUtils");
const GroupCrypto = require("../GroupCrypto");
describe("GroupCrypto", () => {
    describe("createGroup", () => {
        test("generates new group keypair and encrypts it using the provided public key", () => {
            const userKey = TestUtils.getEmptyPublicKey();
            const signingKeys = TestUtils.getSigningKeyPair();
            const genKey = jest.spyOn(Recrypt, "generateGroupKeyPair");
            genKey.mockReturnValue(futurejs_1.default.of({
                publicKey: Buffer.alloc(32),
                plaintext: Buffer.alloc(12),
                privateKey: Buffer.alloc(29),
            }));
            const encrypt = jest.spyOn(Recrypt, "encryptPlaintext");
            encrypt.mockReturnValue(futurejs_1.default.of({
                encryptedMessage: "stuff",
            }));
            const transform = jest.spyOn(Recrypt, "generateTransformKey");
            transform.mockReturnValue(futurejs_1.default.of({
                fromPrivateKey: Buffer.alloc(29),
                toPublicKey: TestUtils.getEmptyPublicKey(),
            }));
            GroupCrypto.createGroup(userKey, signingKeys.privateKey, true).engage((e) => fail(e), (groupKeys) => {
                expect(groupKeys.encryptedGroupKey).toEqual({ encryptedMessage: "stuff" });
                expect(groupKeys.groupPublicKey).toEqual(Buffer.alloc(32));
                expect(Recrypt.generateGroupKeyPair).toHaveBeenCalledWith();
                expect(Recrypt.encryptPlaintext).toHaveBeenCalledWith(Buffer.alloc(12), userKey, signingKeys.privateKey);
                expect(Recrypt.generateTransformKey).toHaveBeenCalledWith(Buffer.alloc(29), TestUtils.getEmptyPublicKey(), signingKeys.privateKey);
            });
        });
        test("does not generate a transform key if addAsMember is false", () => {
            const userKey = TestUtils.getEmptyPublicKey();
            const signingKeys = TestUtils.getSigningKeyPair();
            const keyGen = jest.spyOn(Recrypt, "generateGroupKeyPair");
            keyGen.mockReturnValue(futurejs_1.default.of({
                publicKey: Buffer.alloc(32),
                plaintext: Buffer.alloc(12),
                privateKey: Buffer.alloc(29),
            }));
            const encrypt = jest.spyOn(Recrypt, "encryptPlaintext");
            encrypt.mockReturnValue(futurejs_1.default.of({
                encryptedMessage: "stuff",
            }));
            const transform = jest.spyOn(Recrypt, "generateTransformKey");
            transform.mockReturnValue(futurejs_1.default.of({
                fromPrivateKey: Buffer.alloc(29),
                toPublicKey: TestUtils.getEmptyPublicKey(),
            }));
            GroupCrypto.createGroup(userKey, signingKeys.privateKey, false).engage((e) => fail(e), (groupKeys) => {
                expect(groupKeys.encryptedGroupKey).toEqual({ encryptedMessage: "stuff" });
                expect(groupKeys.groupPublicKey).toEqual(Buffer.alloc(32));
                expect(Recrypt.generateGroupKeyPair).toHaveBeenCalledWith();
                expect(Recrypt.encryptPlaintext).toHaveBeenCalledWith(Buffer.alloc(12), userKey, signingKeys.privateKey);
                expect(Recrypt.generateTransformKey).not.toHaveBeenCalled();
            });
        });
        test("maps errors to SDKError with specific error code", () => {
            const signingKeys = TestUtils.getSigningKeyPair();
            const genKey = jest.spyOn(Recrypt, "generateGroupKeyPair");
            genKey.mockReturnValue(futurejs_1.default.reject(new Error("group key gen failure")));
            GroupCrypto.createGroup(TestUtils.getEmptyPublicKey(), signingKeys.privateKey, false).engage((error) => {
                expect(error.message).toEqual("group key gen failure");
                expect(error.code).toEqual(Constants_1.ErrorCodes.GROUP_KEY_GENERATION_FAILURE);
            }, () => fail("Success should not be invoked when operations fail"));
        });
    });
    describe("rotateGroupKey", () => {
        test("decrypts groups private key, rotates it, and re-encrypts it to the provided list of users ", () => {
            jest.spyOn(Recrypt, "decryptPlaintext").mockReturnValue(futurejs_1.default.of([Buffer.from([]), Buffer.from("groupSymmetricKey")]));
            jest.spyOn(Recrypt, "rotateGroupPrivateKeyWithRetry").mockReturnValue(futurejs_1.default.of({
                plaintext: Buffer.from("groupPlaintext"),
                augmentationFactor: Buffer.from("augFactor"),
            }));
            jest.spyOn(Recrypt, "encryptPlaintextToList").mockReturnValue(futurejs_1.default.of(["accessKey1", "accessKey2"]));
            GroupCrypto.rotateGroupKey(TestUtils.getTransformedSymmetricKey(), [{ id: "11", masterPublicKey: TestUtils.accountPublicBytesBase64 }], TestUtils.devicePrivateBytes, TestUtils.getSigningKeyPair()).engage((e) => fail(e), (res) => {
                expect(res).toEqual({
                    encryptedAccessKeys: ["accessKey1", "accessKey2"],
                    augmentationFactor: Buffer.from("augFactor"),
                });
                expect(Recrypt.decryptPlaintext).toHaveBeenCalledWith(TestUtils.getTransformedSymmetricKey(), TestUtils.devicePrivateBytes);
                expect(Recrypt.rotateGroupPrivateKeyWithRetry).toHaveBeenCalledWith(Buffer.from("groupSymmetricKey"));
                expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(Buffer.from("groupPlaintext"), [{ id: "11", masterPublicKey: TestUtils.accountPublicBytesBase64 }], expect.any(Buffer));
            });
        });
        test("maps error to proper error code", () => {
            jest.spyOn(Recrypt, "decryptPlaintext").mockReturnValue(futurejs_1.default.reject(new Error("failed to decrypt")));
            GroupCrypto.rotateGroupKey(TestUtils.getTransformedSymmetricKey(), [{ id: "11", masterPublicKey: TestUtils.accountPublicBytesBase64 }], TestUtils.devicePrivateBytes, TestUtils.getSigningKeyPair()).engage((e) => {
                expect(e.code).toEqual(Constants_1.ErrorCodes.GROUP_PRIVATE_KEY_ROTATION_FAILURE);
            }, () => fail("Should reject when cannot decrypt"));
        });
    });
    describe("addAdminsToGroup", () => {
        test("decrypts group private key encrypts it to the provided list of public keys", () => {
            const decrypt = jest.spyOn(Recrypt, "decryptPlaintext");
            decrypt.mockReturnValue(futurejs_1.default.of(["decryptedPlaintext"]));
            const encrypt = jest.spyOn(Recrypt, "encryptPlaintextToList");
            encrypt.mockReturnValue(futurejs_1.default.of(["accessKey1", "accessKey2"]));
            const groupPrivateKey = TestUtils.getTransformedSymmetricKey();
            const adminPrivateKey = Buffer.alloc(20);
            const userList = [{ id: "user-35", masterPublicKey: { x: "", y: "" } }];
            const signingKeys = TestUtils.getSigningKeyPair();
            GroupCrypto.addAdminsToGroup(groupPrivateKey, userList, adminPrivateKey, signingKeys.privateKey).engage((e) => fail(e.message), (result) => {
                expect(result).toEqual(["accessKey1", "accessKey2"]);
                expect(Recrypt.decryptPlaintext).toHaveBeenCalledWith(groupPrivateKey, adminPrivateKey);
                expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith("decryptedPlaintext", userList, signingKeys.privateKey);
            });
        });
        test("maps errors to SDKError with expected error code", () => {
            const decrypt = jest.spyOn(Recrypt, "decryptPlaintext");
            decrypt.mockReturnValue(futurejs_1.default.reject(new Error("plaintext decryption failed")));
            const groupPrivateKey = TestUtils.getTransformedSymmetricKey();
            const adminPrivateKey = Buffer.alloc(20);
            const userList = [{ id: "user-35", masterPublicKey: { x: "", y: "" } }];
            const signingKeys = TestUtils.getSigningKeyPair();
            GroupCrypto.addAdminsToGroup(groupPrivateKey, userList, adminPrivateKey, signingKeys.privateKey).engage((error) => {
                expect(error.message).toEqual("plaintext decryption failed");
                expect(error.code).toEqual(Constants_1.ErrorCodes.GROUP_KEY_DECRYPTION_FAILURE);
            }, () => fail("Success should not be invoked when operations fail"));
        });
    });
    describe("addMembersToGroup", () => {
        test("decrypts key and reencrypts it to the list of users provided", (done) => {
            const decrypt = jest.spyOn(Recrypt, "decryptPlaintext");
            decrypt.mockReturnValue(futurejs_1.default.of(["anything", "documentSymKey"]));
            const transform = jest.spyOn(Recrypt, "generateTransformKeyToList");
            transform.mockReturnValue(futurejs_1.default.of("keysForUser"));
            const groupPrivateKey = TestUtils.getTransformedSymmetricKey();
            const adminPrivateKey = Buffer.alloc(20);
            const userList = [{ id: "user-35", masterPublicKey: { x: "", y: "" } }];
            const signingKeys = TestUtils.getSigningKeyPair();
            GroupCrypto.addMembersToGroup(groupPrivateKey, userList, adminPrivateKey, signingKeys.privateKey).engage((e) => fail(e), (result) => {
                expect(result).toEqual("keysForUser");
                expect(Recrypt.decryptPlaintext).toHaveBeenCalledWith(groupPrivateKey, adminPrivateKey);
                expect(Recrypt.generateTransformKeyToList).toHaveBeenCalledWith("documentSymKey", userList, signingKeys.privateKey);
                done();
            });
        });
        test("maps errors to SDKError with specific error code", () => {
            const decrypt = jest.spyOn(Recrypt, "decryptPlaintext");
            decrypt.mockReturnValue(futurejs_1.default.reject(new Error("plaintext decryption failed")));
            const groupPrivateKey = TestUtils.getTransformedSymmetricKey();
            const adminPrivateKey = Buffer.alloc(20);
            const userList = [{ id: "user-35", masterPublicKey: { x: "", y: "" } }];
            const signingKeys = TestUtils.getSigningKeyPair();
            GroupCrypto.addMembersToGroup(groupPrivateKey, userList, adminPrivateKey, signingKeys.privateKey).engage((error) => {
                expect(error.message).toEqual("plaintext decryption failed");
                expect(error.code).toEqual(Constants_1.ErrorCodes.GROUP_MEMBER_KEY_ENCRYPTION_FAILURE);
            }, () => fail("Success should not be invoked when operations fail"));
        });
    });
});
