import * as DocumentCrypto from "../DocumentCrypto";
import Future from "futurejs";
import * as TestUtils from "../../tests/TestUtils";
import * as AES from "../../crypto/AES";
import * as Recrypt from "../../crypto/Recrypt";
import {ErrorCodes} from "../../Constants";

describe("DocumentCrypto", () => {
    describe("generateDocumentKeys", () => {
        test("generates and returns a plaintext and a symmetric key", () => {
            DocumentCrypto.generateDocumentKeys().engage(
                (e) => fail(e.message),
                (keys) => {
                    expect(keys.documentSymmetricKey).toBeInstanceOf(Buffer);
                    expect(keys.documentSymmetricKey).toBeInstanceOf(Buffer);
                }
            );
        });
    });

    describe("encryptPlaintextToUsersAndGroups", () => {
        test("generates encrypted keys from the provided plaintext to the provided user keys", () => {
            const encryptedUserKeyList = [
                {
                    publicKey: "firstPK",
                    encryptedSymmetricKey: "firstESK",
                },
            ];
            const userPublicKeyList = [{id: "user-33", masterPublicKey: TestUtils.getEmptyPublicKeyString()}];
            const plaintext = Buffer.from([0, 0, 0, 0]);
            const signingKeys = TestUtils.getSigningKeyPair();
            const encryptToList = jest.spyOn(Recrypt, "encryptPlaintextToList");
            encryptToList.mockImplementation((_: any, keyList: any) => {
                if (keyList.length) {
                    return Future.of(encryptedUserKeyList);
                }
                return Future.of([]);
            });

            DocumentCrypto.encryptPlaintextToUsersAndGroups(plaintext, userPublicKeyList, [], signingKeys.privateKey).engage(
                (e) => fail(e.message),
                (result: any) => {
                    expect(result).toEqual({
                        userAccessKeys: encryptedUserKeyList,
                        groupAccessKeys: [],
                    });
                    expect(Recrypt.encryptPlaintextToList as jest.Mock).toHaveBeenCalledTimes(2);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(plaintext, userPublicKeyList, signingKeys.privateKey);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(plaintext, [], signingKeys.privateKey);
                }
            );
        });

        test("generates encrypted keys from the provided plaintext to the provide group keys", () => {
            const encryptedGroupKeyList = [
                {
                    publicKey: "firstPK",
                    encryptedSymmetricKey: "firstESK",
                },
            ];
            const groupPublicKeyList = [{id: "group-33", masterPublicKey: TestUtils.getEmptyPublicKeyString()}];
            const plaintext = Buffer.from([0, 0, 0, 0]);
            const signingKeys = TestUtils.getSigningKeyPair();
            const encryptToList = jest.spyOn(Recrypt, "encryptPlaintextToList");
            encryptToList.mockImplementation((_: any, keyList: any) => {
                if (keyList.length) {
                    return Future.of(encryptedGroupKeyList);
                }
                return Future.of([]);
            });

            DocumentCrypto.encryptPlaintextToUsersAndGroups(plaintext, [], groupPublicKeyList, signingKeys.privateKey).engage(
                (e) => fail(e.message),
                (result: any) => {
                    expect(result).toEqual({
                        userAccessKeys: [],
                        groupAccessKeys: encryptedGroupKeyList,
                    });
                    expect(Recrypt.encryptPlaintextToList as jest.Mock).toHaveBeenCalledTimes(2);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(plaintext, groupPublicKeyList, signingKeys.privateKey);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(plaintext, [], signingKeys.privateKey);
                }
            );
        });

        test("generates encrypted keys for both user and group keys", () => {
            const encryptedUserKeyList = [{publicKey: "firstUserPK", encryptedSymmetricKey: "firstUserESK"}];
            const encryptedGroupKeyList = [
                {publicKey: "firstGroupPK", encryptedSymmetricKey: "firstGroupESK"},
                {publicKey: "secondGroupPK", encryptedSymmetricKey: "secoGroupESK"},
            ];
            const userPublicKeyList = [{id: "user-33", masterPublicKey: TestUtils.getEmptyPublicKeyString()}];
            const groupPublicKeyList = [
                {id: "group-13", masterPublicKey: TestUtils.getEmptyPublicKeyString()},
                {id: "group-39", masterPublicKey: TestUtils.getEmptyPublicKeyString()},
            ];

            const plaintext = Buffer.from([0, 0, 0, 0]);
            const signingKeys = TestUtils.getSigningKeyPair();
            const encryptToList = jest.spyOn(Recrypt, "encryptPlaintextToList");
            encryptToList.mockImplementation((_: any, keyList: any) => {
                if (keyList.length === 1) {
                    return Future.of(encryptedUserKeyList);
                }
                return Future.of(encryptedGroupKeyList);
            });

            DocumentCrypto.encryptPlaintextToUsersAndGroups(plaintext, userPublicKeyList, groupPublicKeyList, signingKeys.privateKey).engage(
                (e) => fail(e.message),
                (result: any) => {
                    expect(result).toEqual({
                        userAccessKeys: encryptedUserKeyList,
                        groupAccessKeys: encryptedGroupKeyList,
                    });
                    expect(Recrypt.encryptPlaintextToList as jest.Mock).toHaveBeenCalledTimes(2);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(plaintext, groupPublicKeyList, signingKeys.privateKey);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(plaintext, userPublicKeyList, signingKeys.privateKey);
                }
            );
        });

        test("maps failure to the expected error code", (done) => {
            const userPublicKeyList = [{id: "user-33", masterPublicKey: TestUtils.getEmptyPublicKeyString()}];
            const encryptToList = jest.spyOn(Recrypt, "encryptPlaintextToList");
            encryptToList.mockReturnValue(Future.reject(new Error("encryptPlaintextToList failed")));
            const signingKeys = TestUtils.getSigningKeyPair();

            DocumentCrypto.encryptPlaintextToUsersAndGroups(Buffer.from([0, 0, 0, 0]), userPublicKeyList, [], signingKeys.privateKey).engage(
                (error) => {
                    expect(error.message).toEqual("encryptPlaintextToList failed");
                    expect(error.code).toEqual(ErrorCodes.DOCUMENT_ENCRYPT_FAILURE);
                    done();
                },
                () => fail("success handler should not be invoked when operation fails")
            );
        });
    });

    describe("encryptBytes", () => {
        test("encrypts the provided documents via AES", () => {
            const generatedKey = Buffer.alloc(38);
            const data = Buffer.alloc(91);
            const dataNonce = Buffer.alloc(12);
            const docToEncrypt = Buffer.alloc(35);

            const aesEncrypt = jest.spyOn(AES, "encryptBytes");
            aesEncrypt.mockReturnValue(
                Future.of({
                    data,
                    dataNonce,
                })
            );

            DocumentCrypto.encryptBytes(Buffer.from([0, 0, 0, 0]), docToEncrypt, generatedKey).engage(
                (e) => fail(e),
                (encryptedData: any) => {
                    expect(encryptedData).toEqual({
                        data,
                        dataNonce,
                    });
                    expect(AES.encryptBytes).toHaveBeenCalledWith(Buffer.from([0, 0, 0, 0]), docToEncrypt, generatedKey);
                }
            );
        });

        test("maps failures to SDK error with specific error code", (done) => {
            const aesEncrypt = jest.spyOn(AES, "encryptBytes");
            aesEncrypt.mockReturnValue(Future.reject(new Error("aes encrypt")));

            DocumentCrypto.encryptBytes(Buffer.from([0, 0, 0, 0]), Buffer.alloc(35), Buffer.from([33, 113, 53])).engage(
                (error) => {
                    expect(error.message).toEqual("aes encrypt");
                    expect(error.code).toEqual(ErrorCodes.DOCUMENT_ENCRYPT_FAILURE);
                    done();
                },
                () => fail("success handler should not be invoked when operation fails")
            );
        });
    });

    describe("encryptStream", () => {
        test("encrypts the stream with the provided data", () => {
            const generatedKey = Buffer.alloc(38);
            const aesEncrypt = jest.spyOn(AES, "encryptStream");
            aesEncrypt.mockReturnValue(Future.of(undefined));

            DocumentCrypto.encryptStream(Buffer.from([0, 0, 0, 0]), generatedKey, "inputStream" as any, "outputStream" as any).engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toBeUndefined();
                    expect(AES.encryptStream).toHaveBeenCalledWith(Buffer.from([0, 0, 0, 0]), "inputStream", "outputStream", generatedKey);
                }
            );
        });

        test("maps failures to SDK error with specific error code", (done) => {
            const aesEncrypt = jest.spyOn(AES, "encryptStream");
            aesEncrypt.mockReturnValue(Future.reject(new Error("aes encrypt")));

            DocumentCrypto.encryptStream(Buffer.from([0, 0, 0, 0]), Buffer.alloc(38), "inputStream" as any, "outputStream" as any).engage(
                (error) => {
                    expect(error.message).toEqual("aes encrypt");
                    expect(error.code).toEqual(ErrorCodes.DOCUMENT_ENCRYPT_FAILURE);
                    done();
                },
                () => fail("success handler should not be invoked when operation fails")
            );
        });
    });

    describe("decryptBytes", () => {
        test("decrypts document key and then decrypts document", () => {
            const decryptedKey = Buffer.alloc(22);
            const plaintext = Buffer.alloc(384);
            const decryptPlaintext = jest.spyOn(Recrypt, "decryptPlaintext");
            decryptPlaintext.mockReturnValue(Future.of([plaintext, decryptedKey]));
            const aesDecrypt = jest.spyOn(AES, "decryptBytes");
            aesDecrypt.mockReturnValue(Future.of("decrypted document"));

            const symKey = TestUtils.getTransformedSymmetricKey();
            const privKey = Buffer.alloc(32);
            DocumentCrypto.decryptBytes(Buffer.alloc(87), symKey, privKey).engage(
                (e) => fail(e),
                (decryptedData: any) => {
                    expect(decryptedData).toEqual("decrypted document");
                    expect(Recrypt.decryptPlaintext).toHaveBeenCalledWith(symKey, privKey);
                    expect(AES.decryptBytes).toHaveBeenCalledWith(expect.any(Buffer), decryptedKey);
                }
            );
        });

        test("maps failures to SDK error with specific error code", () => {
            const recryptDecrypt = jest.spyOn(Recrypt, "decryptPlaintext");
            recryptDecrypt.mockReturnValue(Future.reject(new Error("plaintext decryption failure")));

            DocumentCrypto.decryptBytes(Buffer.alloc(89), TestUtils.getTransformedSymmetricKey(), Buffer.alloc(32)).engage(
                (error) => {
                    expect(error.message).toEqual("plaintext decryption failure");
                    expect(error.code).toEqual(ErrorCodes.DOCUMENT_DECRYPT_FAILURE);
                },
                () => fail("success handler should not be invoked when operation fails")
            );
        });
    });

    describe("decryptStream", () => {
        test("decrypts document key and then decrypts stream", () => {
            const decryptedKey = Buffer.alloc(22);
            const plaintext = Buffer.alloc(384);
            const decryptPlaintext = jest.spyOn(Recrypt, "decryptPlaintext");
            decryptPlaintext.mockReturnValue(Future.of([plaintext, decryptedKey]));
            const aesDecrypt = jest.spyOn(AES, "decryptStream");
            aesDecrypt.mockReturnValue(Future.of(undefined));

            const symKey = TestUtils.getTransformedSymmetricKey();
            const privKey = Buffer.alloc(32);
            DocumentCrypto.decryptStream("inputStream" as any, "outputPath", symKey, privKey).engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toBeUndefined();
                    expect(Recrypt.decryptPlaintext).toHaveBeenCalledWith(symKey, privKey);
                    expect(AES.decryptStream).toHaveBeenCalledWith("inputStream", "outputPath", decryptedKey);
                }
            );
        });

        test("maps failures to SDK error with specific error code", () => {
            const recryptDecrypt = jest.spyOn(Recrypt, "decryptPlaintext");
            recryptDecrypt.mockReturnValue(Future.reject(new Error("plaintext decryption failure")));

            DocumentCrypto.decryptStream("inputStream" as any, "outputPath", TestUtils.getTransformedSymmetricKey(), Buffer.alloc(32)).engage(
                (error) => {
                    expect(error.message).toEqual("plaintext decryption failure");
                    expect(error.code).toEqual(ErrorCodes.DOCUMENT_DECRYPT_FAILURE);
                },
                () => fail("success handler should not be invoked when operation fails")
            );
        });
    });

    describe("reEncryptBytes", () => {
        test("decrypts document key and then encrypts document", () => {
            const decryptKey = Buffer.alloc(38);
            const plaintext = Buffer.alloc(384);
            const decryptResult = {
                data: Buffer.alloc(91),
                dataNonce: Buffer.alloc(12),
            };

            const recryptDecrypt = jest.spyOn(Recrypt, "decryptPlaintext");
            recryptDecrypt.mockReturnValue(Future.of([plaintext, decryptKey]));
            const aesEncrypt = jest.spyOn(AES, "encryptBytes");
            aesEncrypt.mockReturnValue(Future.of(decryptResult));

            const symKey = TestUtils.getTransformedSymmetricKey();
            const newData = Buffer.alloc(35);
            const privKey = Buffer.alloc(32);

            DocumentCrypto.reEncryptBytes(Buffer.from([0, 0, 0, 0]), newData, symKey, privKey).engage(
                (e) => fail(e),
                (decryptedData: any) => {
                    expect(decryptedData).toEqual(decryptResult);
                    expect(Recrypt.decryptPlaintext).toHaveBeenCalledWith(symKey, privKey);
                    expect(AES.encryptBytes).toHaveBeenCalledWith(Buffer.from([0, 0, 0, 0]), newData, decryptKey);
                }
            );
        });

        test("maps failures to SDK error with specific error code", () => {
            const recryptDecrypt = jest.spyOn(Recrypt, "decryptPlaintext");
            recryptDecrypt.mockReturnValue(Future.reject(new Error("plaintext decrypt failure")));
            DocumentCrypto.reEncryptBytes(Buffer.from([0, 0, 0, 0]), Buffer.alloc(35), TestUtils.getTransformedSymmetricKey(), Buffer.alloc(32)).engage(
                (error) => {
                    expect(error.message).toEqual("plaintext decrypt failure");
                    expect(error.code).toEqual(ErrorCodes.DOCUMENT_REENCRYPT_FAILURE);
                },
                () => fail("success handler should not be invoked when operation fails")
            );
        });
    });

    describe("reEncryptStream", () => {
        test("decrypts document key and then encrypts stream", () => {
            const decryptKey = Buffer.alloc(38);
            const plaintext = Buffer.alloc(384);

            const recryptDecrypt = jest.spyOn(Recrypt, "decryptPlaintext");
            recryptDecrypt.mockReturnValue(Future.of([plaintext, decryptKey]));
            const encryptStream = jest.spyOn(AES, "encryptStream");
            encryptStream.mockReturnValue(Future.of(undefined));

            const symKey = TestUtils.getTransformedSymmetricKey();
            const privKey = Buffer.alloc(32);

            DocumentCrypto.reEncryptStream(Buffer.from([0, 0, 0, 0]), "inputStream" as any, "outputStream" as any, symKey, privKey).engage(
                (e) => fail(e),
                (result: any) => {
                    expect(result).toBeUndefined();
                    expect(Recrypt.decryptPlaintext).toHaveBeenCalledWith(symKey, privKey);
                    expect(AES.encryptStream).toHaveBeenCalledWith(Buffer.from([0, 0, 0, 0]), "inputStream", "outputStream", decryptKey);
                }
            );
        });

        test("maps failures to SDK error with specific error code", () => {
            const recryptDecrypt = jest.spyOn(Recrypt, "decryptPlaintext");
            recryptDecrypt.mockReturnValue(Future.reject(new Error("plaintext decrypt failure")));
            DocumentCrypto.reEncryptStream(
                Buffer.from([0, 0, 0, 0]),
                "inputStream" as any,
                "outputStream" as any,
                TestUtils.getTransformedSymmetricKey(),
                Buffer.alloc(32)
            ).engage(
                (error) => {
                    expect(error.message).toEqual("plaintext decrypt failure");
                    expect(error.code).toEqual(ErrorCodes.DOCUMENT_REENCRYPT_FAILURE);
                },
                () => fail("success handler should not be invoked when operation fails")
            );
        });
    });

    describe("encryptDocumentToKeys", () => {
        test("encrypts new list of symmetric keys and calls document grant endpoint", () => {
            const decryptPlaintext = Buffer.alloc(384);
            const decryptKey = Buffer.alloc(5);
            const EncryptedAccessKeyList = [
                {
                    publicKey: "firstPK",
                    encryptedSymmetricKey: "firstESK",
                },
                {
                    publicKey: "secondPK",
                    encryptedSymmetricKey: "secondESK",
                },
            ];

            const recryptDecrypt = jest.spyOn(Recrypt, "decryptPlaintext");
            recryptDecrypt.mockReturnValue(Future.of([decryptPlaintext, decryptKey]));
            const recryptEncrypt = jest.spyOn(Recrypt, "encryptPlaintextToList");
            recryptEncrypt.mockReturnValue(Future.of(EncryptedAccessKeyList));

            const userList = [{id: "abc-123", masterPublicKey: {x: "", y: ""}}, {id: "def-456", masterPublicKey: {x: "", y: ""}}];
            const groupList = [{id: "group-353", masterPublicKey: {x: "", y: ""}}];
            const encryptedSymKey = TestUtils.getTransformedSymmetricKey();
            const signingKeys = TestUtils.getSigningKeyPair();

            DocumentCrypto.encryptDocumentToKeys(TestUtils.getTransformedSymmetricKey(), userList, groupList, Buffer.alloc(32), signingKeys.privateKey).engage(
                (e) => fail(e.message),
                (resp: any) => {
                    expect(resp).toEqual({
                        userAccessKeys: EncryptedAccessKeyList,
                        groupAccessKeys: EncryptedAccessKeyList,
                    });
                    expect(Recrypt.decryptPlaintext).toHaveBeenCalledWith(encryptedSymKey, Buffer.alloc(32));
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(decryptPlaintext, userList, signingKeys.privateKey);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(decryptPlaintext, groupList, signingKeys.privateKey);
                }
            );
        });

        test("maps failures to SDK error with specific error code", () => {
            const decryptRecrypt = jest.spyOn(Recrypt, "decryptPlaintext");
            decryptRecrypt.mockReturnValue(Future.reject(new Error("plaintext decrypt failure")));
            DocumentCrypto.encryptDocumentToKeys(
                TestUtils.getTransformedSymmetricKey(),
                [],
                [],
                Buffer.alloc(32),
                TestUtils.getSigningKeyPair().privateKey
            ).engage(
                (error) => {
                    expect(error.message).toEqual("plaintext decrypt failure");
                    expect(error.code).toEqual(ErrorCodes.DOCUMENT_GRANT_ACCESS_FAILURE);
                },
                () => fail("success handler should not be invoked when operation fails")
            );
        });
    });
});
