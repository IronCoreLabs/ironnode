import Future from "futurejs";
import * as GroupCrypto from "../GroupCrypto";
import * as Recrypt from "../../crypto/Recrypt";
import * as TestUtils from "../../tests/TestUtils";
import {ErrorCodes} from "../../Constants";

describe("GroupCrypto", () => {
    describe("createGroup", () => {
        test("generates new group keypair and encrypts it using the provided public key", () => {
            const userKey = TestUtils.getEmptyPublicKey();
            const signingKeys = TestUtils.getSigningKeyPair();

            const genKey = jest.spyOn(Recrypt, "generateGroupKeyPair");
            genKey.mockReturnValue(
                Future.of({
                    publicKey: Buffer.alloc(32),
                    plaintext: Buffer.alloc(12),
                    privateKey: Buffer.alloc(29),
                })
            );

            const encrypt = jest.spyOn(Recrypt, "encryptPlaintext");
            encrypt.mockReturnValue(
                Future.of({
                    encryptedMessage: "stuff",
                })
            );

            const transform = jest.spyOn(Recrypt, "generateTransformKey");
            transform.mockReturnValue(
                Future.of({
                    fromPrivateKey: Buffer.alloc(29),
                    toPublicKey: TestUtils.getEmptyPublicKey(),
                })
            );

            GroupCrypto.createGroup(userKey, signingKeys.privateKey, true).engage(
                (e) => fail(e),
                (groupKeys: any) => {
                    expect(groupKeys.encryptedGroupKey).toEqual({encryptedMessage: "stuff"});
                    expect(groupKeys.groupPublicKey).toEqual(Buffer.alloc(32));

                    expect(Recrypt.generateGroupKeyPair).toHaveBeenCalledWith();
                    expect(Recrypt.encryptPlaintext).toHaveBeenCalledWith(Buffer.alloc(12), userKey, signingKeys.privateKey);

                    expect(Recrypt.generateTransformKey).toHaveBeenCalledWith(Buffer.alloc(29), TestUtils.getEmptyPublicKey(), signingKeys.privateKey);
                }
            );
        });

        test("does not generate a transform key if addAsMember is false", () => {
            const userKey = TestUtils.getEmptyPublicKey();
            const signingKeys = TestUtils.getSigningKeyPair();

            const keyGen = jest.spyOn(Recrypt, "generateGroupKeyPair");
            keyGen.mockReturnValue(
                Future.of({
                    publicKey: Buffer.alloc(32),
                    plaintext: Buffer.alloc(12),
                    privateKey: Buffer.alloc(29),
                })
            );

            const encrypt = jest.spyOn(Recrypt, "encryptPlaintext");
            encrypt.mockReturnValue(
                Future.of({
                    encryptedMessage: "stuff",
                })
            );

            const transform = jest.spyOn(Recrypt, "generateTransformKey");
            transform.mockReturnValue(
                Future.of({
                    fromPrivateKey: Buffer.alloc(29),
                    toPublicKey: TestUtils.getEmptyPublicKey(),
                })
            );

            GroupCrypto.createGroup(userKey, signingKeys.privateKey, false).engage(
                (e) => fail(e),
                (groupKeys: any) => {
                    expect(groupKeys.encryptedGroupKey).toEqual({encryptedMessage: "stuff"});
                    expect(groupKeys.groupPublicKey).toEqual(Buffer.alloc(32));

                    expect(Recrypt.generateGroupKeyPair).toHaveBeenCalledWith();
                    expect(Recrypt.encryptPlaintext).toHaveBeenCalledWith(Buffer.alloc(12), userKey, signingKeys.privateKey);

                    expect(Recrypt.generateTransformKey).not.toHaveBeenCalled();
                }
            );
        });

        test("maps errors to SDKError with specific error code", () => {
            const signingKeys = TestUtils.getSigningKeyPair();
            const genKey = jest.spyOn(Recrypt, "generateGroupKeyPair");
            genKey.mockReturnValue(Future.reject(new Error("group key gen failure")));

            GroupCrypto.createGroup(TestUtils.getEmptyPublicKey(), signingKeys.privateKey, false).engage(
                (error) => {
                    expect(error.message).toEqual("group key gen failure");
                    expect(error.code).toEqual(ErrorCodes.GROUP_KEY_GENERATION_FAILURE);
                },
                () => fail("Success should not be invoked when operations fail")
            );
        });
    });

    describe("addAdminsToGroup", () => {
        test("decrypts group private key encrypts it to the provided list of public keys", () => {
            const decrypt = jest.spyOn(Recrypt, "decryptPlaintext");
            decrypt.mockReturnValue(Future.of(["decryptedPlaintext"]));
            const encrypt = jest.spyOn(Recrypt, "encryptPlaintextToList");
            encrypt.mockReturnValue(Future.of(["accessKey1", "accessKey2"]));

            const groupPrivateKey = TestUtils.getTransformedSymmetricKey();
            const adminPrivateKey = Buffer.alloc(20);
            const userList = [{id: "user-35", masterPublicKey: {x: "", y: ""}}];
            const signingKeys = TestUtils.getSigningKeyPair();

            GroupCrypto.addAdminsToGroup(groupPrivateKey, userList, adminPrivateKey, signingKeys.privateKey).engage(
                (e) => fail(e.message),
                (result: any) => {
                    expect(result).toEqual(["accessKey1", "accessKey2"]);
                    expect(Recrypt.decryptPlaintext).toHaveBeenCalledWith(groupPrivateKey, adminPrivateKey);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith("decryptedPlaintext", userList, signingKeys.privateKey);
                }
            );
        });

        test("maps errors to SDKError with expected error code", () => {
            const decrypt = jest.spyOn(Recrypt, "decryptPlaintext");
            decrypt.mockReturnValue(Future.reject(new Error("plaintext decryption failed")));

            const groupPrivateKey = TestUtils.getTransformedSymmetricKey();
            const adminPrivateKey = Buffer.alloc(20);
            const userList = [{id: "user-35", masterPublicKey: {x: "", y: ""}}];
            const signingKeys = TestUtils.getSigningKeyPair();

            GroupCrypto.addAdminsToGroup(groupPrivateKey, userList, adminPrivateKey, signingKeys.privateKey).engage(
                (error) => {
                    expect(error.message).toEqual("plaintext decryption failed");
                    expect(error.code).toEqual(ErrorCodes.GROUP_KEY_DECRYPTION_FAILURE);
                },
                () => fail("Success should not be invoked when operations fail")
            );
        });
    });

    describe("addMembersToGroup", () => {
        test("decrypts key and reencrypts it to the list of users provided", (done) => {
            const decrypt = jest.spyOn(Recrypt, "decryptPlaintext");
            decrypt.mockReturnValue(Future.of(["anything", "documentSymKey"]));
            const transform = jest.spyOn(Recrypt, "generateTransformKeyToList");
            transform.mockReturnValue(Future.of("keysForUser"));

            const groupPrivateKey = TestUtils.getTransformedSymmetricKey();
            const adminPrivateKey = Buffer.alloc(20);
            const userList = [{id: "user-35", masterPublicKey: {x: "", y: ""}}];
            const signingKeys = TestUtils.getSigningKeyPair();

            GroupCrypto.addMembersToGroup(groupPrivateKey, userList, adminPrivateKey, signingKeys.privateKey).engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toEqual("keysForUser");
                    expect(Recrypt.decryptPlaintext).toHaveBeenCalledWith(groupPrivateKey, adminPrivateKey);
                    expect(Recrypt.generateTransformKeyToList).toHaveBeenCalledWith("documentSymKey", userList, signingKeys.privateKey);
                    done();
                }
            );
        });

        test("maps errors to SDKError with specific error code", () => {
            const decrypt = jest.spyOn(Recrypt, "decryptPlaintext");
            decrypt.mockReturnValue(Future.reject(new Error("plaintext decryption failed")));

            const groupPrivateKey = TestUtils.getTransformedSymmetricKey();
            const adminPrivateKey = Buffer.alloc(20);
            const userList = [{id: "user-35", masterPublicKey: {x: "", y: ""}}];
            const signingKeys = TestUtils.getSigningKeyPair();

            GroupCrypto.addMembersToGroup(groupPrivateKey, userList, adminPrivateKey, signingKeys.privateKey).engage(
                (error) => {
                    expect(error.message).toEqual("plaintext decryption failed");
                    expect(error.code).toEqual(ErrorCodes.GROUP_MEMBER_KEY_ENCRYPTION_FAILURE);
                },
                () => fail("Success should not be invoked when operations fail")
            );
        });
    });
});
