import * as DocumentCrypto from "../DocumentCrypto";
import Future from "futurejs";
import * as TestUtils from "../../tests/TestUtils";
import * as AES from "../../crypto/AES";
import * as Recrypt from "../../crypto/Recrypt";
import {ErrorCodes} from "../../Constants";

describe("DocumentCrypto", () => {
    describe("encryptBytes", () => {
        test("generates document key and then encrypts key and document to list of users", () => {
            const generatedKey = Buffer.alloc(38);
            const generatedPlaintext = Buffer.alloc(384);
            const data = Buffer.alloc(91);
            const dataNonce = Buffer.alloc(12);

            const encryptedUserKeyList = [
                {
                    publicKey: "firstPK",
                    encryptedSymmetricKey: "firstESK",
                },
            ];

            const genKey = jest.spyOn(Recrypt, "generateDocumentKey");
            genKey.mockReturnValue(Future.of([generatedPlaintext, generatedKey]));
            const encryptToList = jest.spyOn(Recrypt, "encryptPlaintextToList");
            encryptToList.mockImplementation((_: any, keyList: any) => {
                if (keyList.length) {
                    return Future.of(encryptedUserKeyList);
                }
                return Future.of([]);
            });
            const aesEncrypt = jest.spyOn(AES, "encryptBytes");
            aesEncrypt.mockReturnValue(
                Future.of({
                    data,
                    dataNonce,
                })
            );

            const docToEncrypt = Buffer.alloc(35);
            const userPublicKeyList = [{id: "user-33", masterPublicKey: TestUtils.getEmptyPublicKeyString()}];
            const signingKeys = TestUtils.getSigningKeyPair();

            DocumentCrypto.encryptBytes(Buffer.from([0, 0, 0, 0]), docToEncrypt, userPublicKeyList, [], signingKeys.privateKey).engage(
                (e) => fail(e),
                (decryptedData: any) => {
                    expect(decryptedData).toEqual({
                        userAccessKeys: encryptedUserKeyList,
                        groupAccessKeys: [],
                        encryptedDocument: {data, dataNonce},
                    });
                    expect(Recrypt.generateDocumentKey).toHaveBeenCalledWith();
                    expect(Recrypt.encryptPlaintextToList as jest.Mock).toHaveBeenCalledTimes(2);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(generatedPlaintext, userPublicKeyList, signingKeys.privateKey);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(generatedPlaintext, [], signingKeys.privateKey);
                    expect(AES.encryptBytes).toHaveBeenCalledWith(Buffer.from([0, 0, 0, 0]), docToEncrypt, generatedKey);
                }
            );
        });

        test("generates document key and encrypts to list of groups when provided", () => {
            const generatedKey = Buffer.alloc(38);
            const generatedPlaintext = Buffer.alloc(384);
            const data = Buffer.alloc(91);
            const dataNonce = Buffer.alloc(12);

            const encryptedGroupKeyList = [
                {
                    publicKey: "firstPK",
                    encryptedSymmetricKey: "firstESK",
                },
            ];

            const genKey = jest.spyOn(Recrypt, "generateDocumentKey");
            genKey.mockReturnValue(Future.of([generatedPlaintext, generatedKey]));
            const encryptRecrypt = jest.spyOn(Recrypt, "encryptPlaintextToList");
            encryptRecrypt.mockImplementation((_: any, keyList: any) => {
                if (keyList.length) {
                    return Future.of(encryptedGroupKeyList);
                }
                return Future.of([]);
            });
            const aesEncrypt = jest.spyOn(AES, "encryptBytes");
            aesEncrypt.mockReturnValue(
                Future.of({
                    data,
                    dataNonce,
                })
            );

            const docToEncrypt = Buffer.alloc(35);
            const groupPublicKeyList = [{id: "user-33", masterPublicKey: TestUtils.getEmptyPublicKeyString()}];
            const signingKeys = TestUtils.getSigningKeyPair();

            DocumentCrypto.encryptBytes(Buffer.from([0, 0, 0, 0]), docToEncrypt, [], groupPublicKeyList, signingKeys.privateKey).engage(
                (e) => fail(e),
                (decryptedData: any) => {
                    expect(decryptedData).toEqual({
                        userAccessKeys: [],
                        groupAccessKeys: encryptedGroupKeyList,
                        encryptedDocument: {data, dataNonce},
                    });
                    expect(Recrypt.generateDocumentKey).toHaveBeenCalledWith();
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledTimes(2);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(generatedPlaintext, groupPublicKeyList, signingKeys.privateKey);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(generatedPlaintext, [], signingKeys.privateKey);
                    expect(AES.encryptBytes).toHaveBeenCalledWith(Buffer.from([0, 0, 0, 0]), docToEncrypt, generatedKey);
                }
            );
        });

        test("generates document key and encrypts to both users and groups when provided", () => {
            const generatedKey = Buffer.alloc(38);
            const generatedPlaintext = Buffer.alloc(384);
            const data = Buffer.alloc(91);
            const dataNonce = Buffer.alloc(12);

            const encryptedUserKeyList = [{publicKey: "firstUserPK", encryptedSymmetricKey: "firstUserESK"}];
            const encryptedGroupKeyList = [
                {publicKey: "firstGroupPK", encryptedSymmetricKey: "firstGroupESK"},
                {publicKey: "secondGroupPK", encryptedSymmetricKey: "secoGroupESK"},
            ];

            const recryptGen = jest.spyOn(Recrypt, "generateDocumentKey");
            recryptGen.mockReturnValue(Future.of([generatedPlaintext, generatedKey]));
            const recryptEncrypt = jest.spyOn(Recrypt, "encryptPlaintextToList");
            recryptEncrypt.mockImplementation((_: any, keyList: any) => {
                if (keyList.length === 1) {
                    return Future.of(encryptedUserKeyList);
                }
                return Future.of(encryptedGroupKeyList);
            });
            const aesEncrypt = jest.spyOn(AES, "encryptBytes");
            aesEncrypt.mockReturnValue(
                Future.of({
                    data,
                    dataNonce,
                })
            );

            const docToEncrypt = Buffer.alloc(35);
            const userPublicKeyList = [{id: "user-33", masterPublicKey: TestUtils.getEmptyPublicKeyString()}];
            const groupPublicKeyList = [
                {id: "group-13", masterPublicKey: TestUtils.getEmptyPublicKeyString()},
                {id: "group-39", masterPublicKey: TestUtils.getEmptyPublicKeyString()},
            ];
            const signingKeys = TestUtils.getSigningKeyPair();

            DocumentCrypto.encryptBytes(Buffer.from([0, 0, 0, 0]), docToEncrypt, userPublicKeyList, groupPublicKeyList, signingKeys.privateKey).engage(
                (e) => fail(e),
                (decryptedData: any) => {
                    expect(decryptedData).toEqual({
                        userAccessKeys: encryptedUserKeyList,
                        groupAccessKeys: encryptedGroupKeyList,
                        encryptedDocument: {data, dataNonce},
                    });
                    expect(Recrypt.generateDocumentKey).toHaveBeenCalledWith();
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledTimes(2);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(generatedPlaintext, userPublicKeyList, signingKeys.privateKey);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(generatedPlaintext, groupPublicKeyList, signingKeys.privateKey);
                    expect(AES.encryptBytes).toHaveBeenCalledWith(Buffer.from([0, 0, 0, 0]), docToEncrypt, generatedKey);
                }
            );
        });

        test("maps failures to SDK error with specific error code", (done) => {
            const recryptKeygen = jest.spyOn(Recrypt, "generateDocumentKey");
            recryptKeygen.mockReturnValue(Future.reject(new Error("generate doc key failure")));

            DocumentCrypto.encryptBytes(Buffer.from([0, 0, 0, 0]), Buffer.alloc(35), [], [], TestUtils.getSigningKeyPair().privateKey).engage(
                (error) => {
                    expect(error.message).toEqual("generate doc key failure");
                    expect(error.code).toEqual(ErrorCodes.DOCUMENT_ENCRYPT_FAILURE);
                    done();
                },
                () => fail("success handler should not be invoked when operation fails")
            );
        });
    });

    describe("encryptStream", () => {
        test("generates document key and then encrypts key and document stream to list of users", () => {
            const generatedKey = Buffer.alloc(38);
            const generatedPlaintext = Buffer.alloc(384);

            const encryptedUserKeyList = [
                {
                    publicKey: "firstPK",
                    encryptedSymmetricKey: "firstESK",
                },
            ];

            const genKey = jest.spyOn(Recrypt, "generateDocumentKey");
            genKey.mockReturnValue(Future.of([generatedPlaintext, generatedKey]));
            const encryptToList = jest.spyOn(Recrypt, "encryptPlaintextToList");
            encryptToList.mockImplementation((_: any, keyList: any) => {
                if (keyList.length) {
                    return Future.of(encryptedUserKeyList);
                }
                return Future.of([]);
            });
            const aesEncrypt = jest.spyOn(AES, "encryptStream");
            aesEncrypt.mockReturnValue(Future.of(undefined));

            const userPublicKeyList = [{id: "user-33", masterPublicKey: TestUtils.getEmptyPublicKeyString()}];
            const signingKeys = TestUtils.getSigningKeyPair();

            DocumentCrypto.encryptStream(
                Buffer.from([0, 0, 0, 0]),
                "inputStream" as any,
                "outputStream" as any,
                userPublicKeyList,
                [],
                signingKeys.privateKey
            ).engage(
                (e) => fail(e),
                (decryptedData: any) => {
                    expect(decryptedData).toEqual({
                        userAccessKeys: encryptedUserKeyList,
                        groupAccessKeys: [],
                    });
                    expect(Recrypt.generateDocumentKey).toHaveBeenCalledWith();
                    expect(Recrypt.encryptPlaintextToList as jest.Mock).toHaveBeenCalledTimes(2);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(generatedPlaintext, userPublicKeyList, signingKeys.privateKey);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(generatedPlaintext, [], signingKeys.privateKey);
                    expect(AES.encryptStream).toHaveBeenCalledWith(Buffer.from([0, 0, 0, 0]), "inputStream", "outputStream", generatedKey);
                }
            );
        });

        test("generates document key and encrypts stream to list of groups when provided", () => {
            const generatedKey = Buffer.alloc(38);
            const generatedPlaintext = Buffer.alloc(384);

            const encryptedGroupKeyList = [
                {
                    publicKey: "firstPK",
                    encryptedSymmetricKey: "firstESK",
                },
            ];

            const genKey = jest.spyOn(Recrypt, "generateDocumentKey");
            genKey.mockReturnValue(Future.of([generatedPlaintext, generatedKey]));
            const encryptRecrypt = jest.spyOn(Recrypt, "encryptPlaintextToList");
            encryptRecrypt.mockImplementation((_: any, keyList: any) => {
                if (keyList.length) {
                    return Future.of(encryptedGroupKeyList);
                }
                return Future.of([]);
            });
            const aesEncrypt = jest.spyOn(AES, "encryptStream");
            aesEncrypt.mockReturnValue(Future.of(undefined));

            const groupPublicKeyList = [{id: "user-33", masterPublicKey: TestUtils.getEmptyPublicKeyString()}];
            const signingKeys = TestUtils.getSigningKeyPair();

            DocumentCrypto.encryptStream(
                Buffer.from([0, 0, 0, 0]),
                "inputStream" as any,
                "outputStream" as any,
                [],
                groupPublicKeyList,
                signingKeys.privateKey
            ).engage(
                (e) => fail(e),
                (decryptedData: any) => {
                    expect(decryptedData).toEqual({
                        userAccessKeys: [],
                        groupAccessKeys: encryptedGroupKeyList,
                    });
                    expect(Recrypt.generateDocumentKey).toHaveBeenCalledWith();
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledTimes(2);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(generatedPlaintext, groupPublicKeyList, signingKeys.privateKey);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(generatedPlaintext, [], signingKeys.privateKey);
                    expect(AES.encryptStream).toHaveBeenCalledWith(Buffer.from([0, 0, 0, 0]), "inputStream", "outputStream", generatedKey);
                }
            );
        });

        test("generates document key and encrypts stream to both users and groups when provided", () => {
            const generatedKey = Buffer.alloc(38);
            const generatedPlaintext = Buffer.alloc(384);

            const encryptedUserKeyList = [{publicKey: "firstUserPK", encryptedSymmetricKey: "firstUserESK"}];
            const encryptedGroupKeyList = [
                {publicKey: "firstGroupPK", encryptedSymmetricKey: "firstGroupESK"},
                {publicKey: "secondGroupPK", encryptedSymmetricKey: "secoGroupESK"},
            ];

            const recryptGen = jest.spyOn(Recrypt, "generateDocumentKey");
            recryptGen.mockReturnValue(Future.of([generatedPlaintext, generatedKey]));
            const recryptEncrypt = jest.spyOn(Recrypt, "encryptPlaintextToList");
            recryptEncrypt.mockImplementation((_: any, keyList: any) => {
                if (keyList.length === 1) {
                    return Future.of(encryptedUserKeyList);
                }
                return Future.of(encryptedGroupKeyList);
            });
            const aesEncrypt = jest.spyOn(AES, "encryptStream");
            aesEncrypt.mockReturnValue(Future.of(undefined));

            const userPublicKeyList = [{id: "user-33", masterPublicKey: TestUtils.getEmptyPublicKeyString()}];
            const groupPublicKeyList = [
                {id: "group-13", masterPublicKey: TestUtils.getEmptyPublicKeyString()},
                {id: "group-39", masterPublicKey: TestUtils.getEmptyPublicKeyString()},
            ];
            const signingKeys = TestUtils.getSigningKeyPair();

            DocumentCrypto.encryptStream(
                Buffer.from([0, 0, 0, 0]),
                "inputStream" as any,
                "outputStream" as any,
                userPublicKeyList,
                groupPublicKeyList,
                signingKeys.privateKey
            ).engage(
                (e) => fail(e),
                (decryptedData: any) => {
                    expect(decryptedData).toEqual({
                        userAccessKeys: encryptedUserKeyList,
                        groupAccessKeys: encryptedGroupKeyList,
                    });
                    expect(Recrypt.generateDocumentKey).toHaveBeenCalledWith();
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledTimes(2);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(generatedPlaintext, userPublicKeyList, signingKeys.privateKey);
                    expect(Recrypt.encryptPlaintextToList).toHaveBeenCalledWith(generatedPlaintext, groupPublicKeyList, signingKeys.privateKey);
                    expect(AES.encryptStream).toHaveBeenCalledWith(Buffer.from([0, 0, 0, 0]), "inputStream", "outputStream", generatedKey);
                }
            );
        });

        test("maps failures to SDK error with specific error code", (done) => {
            const recryptKeygen = jest.spyOn(Recrypt, "generateDocumentKey");
            recryptKeygen.mockReturnValue(Future.reject(new Error("generate doc key failure")));

            DocumentCrypto.encryptStream(
                Buffer.from([0, 0, 0, 0]),
                "inputStream" as any,
                "outputStream" as any,
                [],
                [],
                TestUtils.getSigningKeyPair().privateKey
            ).engage(
                (error) => {
                    expect(error.message).toEqual("generate doc key failure");
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
