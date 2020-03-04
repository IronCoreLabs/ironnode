import * as TestUtils from "../../tests/TestUtils";
import * as Recrypt from "../Recrypt";

describe("Recrypt", () => {
    describe("generateKeyPair", () => {
        test("should generate a random keypair with expected lengths", () => {
            Recrypt.generateKeyPair().engage(
                (e) => fail(e),
                (keypair) => {
                    expect(keypair).toBeObject();
                    expect(Object.keys(keypair)).toHaveLength(2);
                    expect(keypair.privateKey).toBeInstanceOf(Buffer);
                    expect(keypair.privateKey).toHaveLength(32);
                    expect(keypair.publicKey).toBeObject();
                    expect(Object.keys(keypair.publicKey)).toHaveLength(2);
                    expect(keypair.publicKey.x).toBeInstanceOf(Buffer);
                    expect(keypair.publicKey.x).toHaveLength(32);
                    expect(keypair.publicKey.y).toBeInstanceOf(Buffer);
                    expect(keypair.publicKey.y).toHaveLength(32);
                }
            );
        });
    });

    describe("generateGroupKeyPair", () => {
        test("generates new public, private, and plaintext fields", (done) => {
            Recrypt.generateGroupKeyPair().engage(
                (error) => done.fail(error.message),
                (keys) => {
                    expect(keys.publicKey.x).toBeInstanceOf(Buffer);
                    expect(keys.publicKey.y).toBeInstanceOf(Buffer);
                    expect(keys.privateKey).toBeInstanceOf(Buffer);
                    expect(keys.plaintext).toBeInstanceOf(Buffer);

                    expect(keys.publicKey.x.length).toBeGreaterThanOrEqual(31);
                    expect(keys.publicKey.x.length).toBeLessThanOrEqual(33);
                    expect(keys.publicKey.y.length).toBeGreaterThanOrEqual(31);
                    expect(keys.publicKey.y.length).toBeLessThanOrEqual(33);

                    expect(keys.privateKey.length).toBeGreaterThanOrEqual(31);
                    expect(keys.privateKey.length).toBeLessThanOrEqual(33);
                    expect(keys.plaintext.length).toBeGreaterThanOrEqual(383);
                    expect(keys.plaintext.length).toBeLessThanOrEqual(385);
                    done();
                }
            );
        });
    });

    describe("derivePublicKey", () => {
        test("generates a public key that corresponds to private key", (done) => {
            Recrypt.derivePublicKey(TestUtils.devicePrivateBytes).engage(
                (e) => done.fail(e),
                (derivedPublicKey) => {
                    expect(derivedPublicKey).toEqual({
                        // prettier-ignore
                        x: Buffer.from([124, 60, 239, 3, 85, 109, 23, 136, 28, 70, 87, 145, 49, 204, 211, 166, 182, 41, 181, 153, 105, 30, 146, 24, 207, 169, 27, 103, 0, 119, 164, 231,]),
                        // prettier-ignore
                        y: Buffer.from([90, 84, 76, 254, 121, 98, 84, 174, 244, 90, 178, 58, 224, 241, 166, 105, 56, 105, 255, 187, 70, 84, 230, 233, 120, 231, 69, 42, 12, 124, 178, 47,])
                    });
                    done();
                }
            );
        });
    });

    describe("generateTransformKey", () => {
        test("returns a new transform key from public/private key", (done) => {
            const signingKeys = TestUtils.getSigningKeyPair();
            Recrypt.derivePublicKey(TestUtils.devicePrivateBytes)
                .flatMap((publicKey) => Recrypt.generateTransformKey(TestUtils.devicePrivateBytes, publicKey, signingKeys.privateKey))
                .engage(
                    (e) => done.fail(e),
                    (transformKey) => {
                        expect(transformKey).toBeObject();

                        expect(transformKey.encryptedTempKey).toEqual(expect.any(Buffer));
                        expect(transformKey.encryptedTempKey.length).toEqual(384);

                        expect(transformKey.hashedTempKey).toEqual(expect.any(Buffer));
                        expect(transformKey.hashedTempKey.length).toEqual(128);

                        expect(transformKey.ephemeralPublicKey.x).toEqual(expect.any(Buffer));
                        expect(transformKey.ephemeralPublicKey.y).toEqual(expect.any(Buffer));
                        expect(transformKey.ephemeralPublicKey.x.length).toBeWithin(32, 33);
                        expect(transformKey.ephemeralPublicKey.y.length).toBeWithin(32, 33);

                        expect(transformKey.toPublicKey.x).toEqual(expect.any(Buffer));
                        expect(transformKey.toPublicKey.y).toEqual(expect.any(Buffer));
                        expect(transformKey.toPublicKey.x.length).toBeWithin(32, 33);
                        expect(transformKey.toPublicKey.y.length).toBeWithin(32, 33);

                        expect(transformKey.publicSigningKey).toEqual(signingKeys.publicKey);

                        expect(transformKey.signature).toEqual(expect.any(Buffer));
                        expect(transformKey.signature.length).toEqual(64);
                        done();
                    }
                );
        });
    });

    describe("generateTransformKeyToList", () => {
        test("fails when invalid public key is sent in", (done) => {
            const key1 = {
                masterPublicKey: {
                    x: "AAAA",
                    y: "AA==",
                },
                id: "user-1",
            };
            const key2 = {
                masterPublicKey: {
                    x: "AAA=",
                    y: "AAAA",
                },
                id: "user-2",
            };
            const signingKeys = TestUtils.getSigningKeyPair();

            Recrypt.generateTransformKeyToList(Buffer.alloc(32), [key1, key2], signingKeys.privateKey).engage(
                (e) => {
                    expect(e.message).toBeString();
                    done();
                },
                () => done.fail("Transform should fail when public keys are not valid")
            );
        });

        test("returns an empty array when no keys passed in", (done) => {
            const signingKeys = TestUtils.getSigningKeyPair();
            Recrypt.generateTransformKeyToList(Buffer.alloc(32), [], signingKeys.privateKey).engage(
                (e) => done.fail(e),
                (result) => {
                    expect(result).toEqual([]);
                    done();
                }
            );
        });

        test("generates a tranform key for each key in provided list", (done) => {
            const key1 = {
                masterPublicKey: {
                    x: "iofzenON27PeYqmCcCTxxZxKWsH1DBWpb04Brsa6GDo=",
                    y: "O918eBCWdImkkA7jIcHk3dPhf08TudRmgODFgdXJzHk=",
                },
                id: "user-1",
            };
            const key2 = {
                masterPublicKey: {
                    x: "Ft3BGLPh8FvTsuHGUt+lOYQ5kVPJXeEgP/OHq+T0ijM=",
                    y: "RLsEaIquAnODxB5O6j6I64uDZ0OZsfnbaimovIOLiH0=",
                },
                id: "user-2",
            };
            const signingKeys = TestUtils.getSigningKeyPair();

            Recrypt.generateTransformKeyToList(Buffer.alloc(32), [key1, key2], signingKeys.privateKey).engage(
                (e) => done.fail(e),
                (result) => {
                    expect(result).toBeArrayOfSize(2);

                    const [ts1, ts2] = result;

                    expect(ts1.id).toEqual("user-1");
                    expect(ts1.publicKey).toEqual(key1.masterPublicKey);

                    expect(ts2.id).toEqual("user-2");
                    expect(ts2.publicKey).toEqual(key2.masterPublicKey);

                    expect(ts1.transformKey.publicSigningKey).toEqual(signingKeys.publicKey);
                    expect(ts2.transformKey.signature).toEqual(expect.any(Buffer));
                    expect(ts1.transformKey.encryptedTempKey).toEqual(expect.any(Buffer));
                    expect(ts1.transformKey.hashedTempKey).toEqual(expect.any(Buffer));
                    expect(ts1.transformKey.ephemeralPublicKey.x).toEqual(expect.any(Buffer));
                    expect(ts1.transformKey.ephemeralPublicKey.y).toEqual(expect.any(Buffer));
                    expect(ts1.transformKey.toPublicKey.x).toEqual(expect.any(Buffer));
                    expect(ts1.transformKey.toPublicKey.y).toEqual(expect.any(Buffer));

                    expect(ts1.transformKey.publicSigningKey).toEqual(signingKeys.publicKey);
                    expect(ts2.transformKey.signature).toEqual(expect.any(Buffer));
                    expect(ts2.transformKey.encryptedTempKey).toEqual(expect.any(Buffer));
                    expect(ts2.transformKey.hashedTempKey).toEqual(expect.any(Buffer));
                    expect(ts2.transformKey.ephemeralPublicKey.x).toEqual(expect.any(Buffer));
                    expect(ts2.transformKey.ephemeralPublicKey.y).toEqual(expect.any(Buffer));
                    expect(ts2.transformKey.toPublicKey.x).toEqual(expect.any(Buffer));
                    expect(ts2.transformKey.toPublicKey.y).toEqual(expect.any(Buffer));
                    done();
                }
            );
        });
    });

    describe("generateDocumentKey", () => {
        test("generates document symmetric key", (done) => {
            Recrypt.generateDocumentKey().engage(
                (e) => done.fail(e),
                (key: any) => {
                    expect(key).toBeArrayOfSize(2);
                    expect(key[0]).toEqual(expect.any(Buffer));
                    expect(key[0].length).toBeWithin(383, 385);
                    expect(key[1]).toEqual(expect.any(Buffer));
                    expect(key[1].length).toBeWithin(32, 33);
                    done();
                }
            );
        });
    });

    describe("generateEd25519KeyPair", () => {
        test("generates a pair of keys of expected size", () => {
            const keys = Recrypt.generateEd25519KeyPair();
            expect(Object.keys(keys)).toHaveLength(2);
            expect(keys.privateKey).toBeInstanceOf(Buffer);
            expect(keys.privateKey).toHaveLength(64);

            expect(keys.publicKey).toBeInstanceOf(Buffer);
            expect(keys.publicKey).toHaveLength(32);
        });
    });

    describe("ed25519Sign", () => {
        test("signs the provided message and returns the expected size signature", () => {
            const keys = Recrypt.generateEd25519KeyPair();
            const sig = Recrypt.ed25519Sign(keys.privateKey, Buffer.alloc(62));
            expect(sig).toBeInstanceOf(Buffer);
            expect(sig).toHaveLength(64);
        });
    });

    describe("ed25519Verify", () => {
        test("verifies the signature if its value", () => {
            const keys = Recrypt.generateEd25519KeyPair();
            const message = Buffer.alloc(52);
            const sig = Recrypt.ed25519Sign(keys.privateKey, message);
            expect(Recrypt.ed25519Verify(keys.publicKey, message, sig)).toBeTrue();
        });

        test("fails if the wrong public key is used", () => {
            const keys1 = Recrypt.generateEd25519KeyPair();
            const keys2 = Recrypt.generateEd25519KeyPair();
            const message = Buffer.alloc(52);
            const sig = Recrypt.ed25519Sign(keys1.privateKey, message);
            expect(Recrypt.ed25519Verify(keys2.publicKey, message, sig)).toBeFalse();
        });
    });

    describe("computeEd25519PublicKey", () => {
        test("returns expected public key", () => {
            const keys = Recrypt.generateEd25519KeyPair();
            expect(Recrypt.computeEd25519PublicKey(keys.privateKey)).toEqual(keys.publicKey);
        });
    });

    describe("encryptDocumentKey", () => {
        test("fails when provided public key is invalid", (done) => {
            const signingKeys = TestUtils.getSigningKeyPair();
            const publicKey = {
                x: Buffer.from("AAAA", "base64"),
                y: Buffer.from("AA==", "base64"),
            };
            Recrypt.encryptPlaintext(Buffer.alloc(384), publicKey, signingKeys.privateKey).engage(
                (e) => {
                    expect(e.message).toBeString();
                    done();
                },
                () => done.fail("Method should reject when invalid public keys are provided")
            );
        });

        test("encrypts provided document key", (done) => {
            const signingKeys = TestUtils.getSigningKeyPair();
            const publicKey = {
                x: Buffer.from("iofzenON27PeYqmCcCTxxZxKWsH1DBWpb04Brsa6GDo=", "base64"),
                y: Buffer.from("O918eBCWdImkkA7jIcHk3dPhf08TudRmgODFgdXJzHk=", "base64"),
            };
            Recrypt.generateDocumentKey()
                .flatMap(([plaintext]) => Recrypt.encryptPlaintext(plaintext, publicKey, signingKeys.privateKey))
                .engage(
                    (e) => done.fail(e.message),
                    (encryptedKey) => {
                        expect(encryptedKey.ephemeralPublicKey.x).toEqual(expect.any(String));
                        expect(encryptedKey.ephemeralPublicKey.y).toEqual(expect.any(String));
                        expect(encryptedKey.encryptedMessage).toEqual(expect.any(String));
                        expect(encryptedKey.publicSigningKey).toEqual(expect.any(String));
                        expect(encryptedKey.signature).toEqual(expect.any(String));
                        done();
                    }
                );
        });
    });

    describe("encryptPlaintextToList", () => {
        test("fails when provided public key is invalid", (done) => {
            const user1 = {
                id: "user1",
                masterPublicKey: {
                    x: "AAAA",
                    y: "AAA=",
                },
            };

            const user2 = {
                id: "user2",
                masterPublicKey: {
                    x: "AA==",
                    y: "AAAA",
                },
            };
            const signingKeys = TestUtils.getSigningKeyPair();

            Recrypt.encryptPlaintextToList(Buffer.alloc(384), [user1, user2], signingKeys.privateKey).engage(
                (e) => {
                    expect(e.message).toBeString();
                    done();
                },
                () => done.fail("Method should reject when invalid public keys are provided")
            );
        });

        test("encrypts plaintext to all in list and returns expected response", (done) => {
            const user1 = {
                id: "user1",
                masterPublicKey: {
                    x: "iofzenON27PeYqmCcCTxxZxKWsH1DBWpb04Brsa6GDo=",
                    y: "O918eBCWdImkkA7jIcHk3dPhf08TudRmgODFgdXJzHk=",
                },
            };

            const user2 = {
                id: "user2",
                masterPublicKey: {
                    x: "Ft3BGLPh8FvTsuHGUt+lOYQ5kVPJXeEgP/OHq+T0ijM=",
                    y: "RLsEaIquAnODxB5O6j6I64uDZ0OZsfnbaimovIOLiH0=",
                },
            };
            const signingKeys = TestUtils.getSigningKeyPair();

            Recrypt.encryptPlaintextToList(Buffer.alloc(384), [user1, user2], signingKeys.privateKey).engage(
                (e) => done.fail(e.message),
                (encryptedKeys) => {
                    expect(encryptedKeys).toBeArrayOfSize(2);

                    expect(encryptedKeys[0].publicKey).toEqual(user1.masterPublicKey);
                    expect(encryptedKeys[0].encryptedPlaintext).toContainEntry(["encryptedMessage", expect.any(String)]);
                    expect(encryptedKeys[0].encryptedPlaintext).toContainEntry(["publicSigningKey", expect.any(String)]);
                    expect(encryptedKeys[0].encryptedPlaintext).toContainEntry(["signature", expect.any(String)]);
                    expect(encryptedKeys[0].encryptedPlaintext).toContainKey("ephemeralPublicKey");
                    expect(encryptedKeys[0].encryptedPlaintext.ephemeralPublicKey).toContainEntry(["x", expect.any(String)]);
                    expect(encryptedKeys[0].encryptedPlaintext.ephemeralPublicKey).toContainEntry(["y", expect.any(String)]);
                    expect(encryptedKeys[0].id).toEqual("user1");

                    expect(encryptedKeys[1].publicKey).toEqual(user2.masterPublicKey);
                    expect(encryptedKeys[1].encryptedPlaintext).toContainEntry(["encryptedMessage", expect.any(String)]);
                    expect(encryptedKeys[1].encryptedPlaintext).toContainEntry(["publicSigningKey", expect.any(String)]);
                    expect(encryptedKeys[1].encryptedPlaintext).toContainEntry(["signature", expect.any(String)]);
                    expect(encryptedKeys[1].encryptedPlaintext).toContainKey("ephemeralPublicKey");
                    expect(encryptedKeys[1].encryptedPlaintext.ephemeralPublicKey).toContainEntry(["x", expect.any(String)]);
                    expect(encryptedKeys[1].encryptedPlaintext.ephemeralPublicKey).toContainEntry(["y", expect.any(String)]);
                    expect(encryptedKeys[1].id).toEqual("user2");
                    done();
                }
            );
        });

        test("returns empty list when no keys provided", () => {
            const signingKeys = TestUtils.getSigningKeyPair();
            Recrypt.encryptPlaintextToList(Buffer.alloc(384), [], signingKeys.privateKey).engage(
                (e) => fail(e.message),
                (encryptedKeys) => {
                    expect(encryptedKeys).toBeArrayOfSize(0);
                }
            );
        });
    });

    describe("decryptPlaintext", () => {
        test("decrypts provided plaintext", (done) => {
            //Generate a real ed25519 keypair here because otherwise the zero-padding that'll happen with empty byte arrays will cause decryption to fail
            const {privateKey} = Recrypt.generateEd25519KeyPair();
            const plaintext = Buffer.alloc(384);
            Recrypt.generateGroupKeyPair()
                .flatMap((keys) =>
                    Recrypt.encryptPlaintext(plaintext, keys.publicKey, privateKey).map((encryptedDoc) => ({
                        userPrivKey: keys.privateKey,
                        encryptedDoc,
                    }))
                )
                .flatMap(({encryptedDoc, userPrivKey}) => {
                    const transformedEncryptedKey = {
                        ...encryptedDoc,
                        encryptedSymmetricKey: encryptedDoc.encryptedMessage,
                        transformBlocks: [],
                    };
                    return Recrypt.decryptPlaintext(transformedEncryptedKey, userPrivKey);
                })
                .engage(
                    (e) => fail(e),
                    ([plaintextResult, symmetricKey]) => {
                        expect(plaintextResult).toEqual(plaintext);
                        expect(symmetricKey).toEqual(expect.any(Buffer));
                        expect(symmetricKey.length).toBeWithin(32, 33);
                        done();
                    }
                );
        });
    });

    describe("generateDeviceAddSignature", () => {
        test("generates the expected signature", (done) => {
            const fixedTS = 1234567890123;
            jest.spyOn(Date, "now").mockReturnValue(fixedTS);

            const userKeys = {
                publicKey: {
                    x: Buffer.from("iofzenON27PeYqmCcCTxxZxKWsH1DBWpb04Brsa6GDo=", "base64"),
                    y: Buffer.from("O918eBCWdImkkA7jIcHk3dPhf08TudRmgODFgdXJzHk=", "base64"),
                },
                privateKey: Buffer.from("VeGnAnn6ShDPTR9iHEy0hIX09EAIwqGo5GUZee7PqwU=", "base64"),
            };
            const transformKey = {
                ephemeralPublicKey: {
                    x: Buffer.from("Ft3BGLPh8FvTsuHGUt+lOYQ5kVPJXeEgP/OHq+T0ijM=", "base64"),
                    y: Buffer.from("RLsEaIquAnODxB5O6j6I64uDZ0OZsfnbaimovIOLiH0=", "base64"),
                },
                toPublicKey: {
                    x: Buffer.from("HAq+UwydnbKWinz8zN3G450habvUXGObpHj+eHRSpk8=", "base64"),
                    y: Buffer.from("cuiW6xby5ftFfFQbsbAk+K9UivIA665/JUkH4XJzL0o=", "base64"),
                },
                encryptedTempKey: Buffer.from(
                    "edPkkzVjPVQlKdCGQAtx2nVugbqy1sJ6MNufPyeIAb0HgF9LTiRO9LMOCs9wfY4etPR7R5bvc39nOcF9wiElijc6jbm8LuW4YUtNf4MnZEzlb1mV8yvG9w1da6gSBsZwIWc6H874m9+n2N3xHGsf6SnOzIcgC2L/nGP2rnzHCx8dVsNiXMROHcwULtpSzFnUgGOcQMiAL6dm6sIOCU/XClw6p78Ia8TN6XqjFmVMoSsJF18l5aJDgInhMW8acozVI6b/mLtx1jZoTn5QFnW0zGG/jcZgKHTqckpCM2bBm60X6QH6dZ+oWIeKv9ncI/tOA2w7EwkgP4wPJuAGf1cYrioEDCJmN81SxtiURPHK1VS85iUOBLv5N++C7Hu0KyHbLqxsfLoIjtwNIn8E2S1p+FJu6T0XywtC8xaW03i5X3QyDi46PTYWGA65DTZ+izylctaYwWSWODcsFZbEGVzBT4GJYgJb3fUGRBzWqpWyfS2p78MNpXNGAKc6xTt4uGyF",
                    "base64"
                ),
                hashedTempKey: Buffer.from(
                    "W00HUTpinwT6Fq/S22nLc07cemjf+1KOGxxe7WrtalROQsrT2WCURC1KZBwL3s3wZPpW6bSHzux7FUxtHYSNSjjo2xHyb+q5SNB3q16pU9GGKQMBlLvCwLgVBm/UvoAUaGlLplILlUEzkt4McWbWS38HxPfr2tjGYvEXnljA2A4=",
                    "base64"
                ),
                publicSigningKey: Buffer.from("O2onvM62pC1io6jQKm8Nc2UyFXcd4kOmOsBIoYtZ2ik=", "base64"),
                signature: Buffer.from("509HLURLeCTBC8C4PLkHEHQT/WA8GNZjhKTdCqm4WSJtgEdLSG7Mvk86OYbqQYVjEZu6eg2w8dMWZkIUulLcCg==", "base64"),
            };

            Recrypt.generateDeviceAddSignature("jwt", userKeys, transformKey).engage(
                (e) => fail(e.message),
                (signature) => {
                    expect(Object.keys(signature)).toHaveLength(2);
                    expect(signature.ts).toEqual(fixedTS);
                    //We can't do anything else to verify the value of this signature because the value relies on random bytes which we can't
                    //mock out since the randomness is coming from the binary node-binding file.
                    expect(signature.signature).toBeInstanceOf(Buffer);
                    expect(signature.signature).toHaveLength(64);
                    done();
                }
            );
        }, 15000);
    });

    describe("rotateUsersPrivateKeyWithRetry", () => {
        test("generates new key and augmentation factor", () => {
            //prettier-ignore
            const currentKey = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);

            Recrypt.rotateUsersPrivateKeyWithRetry(currentKey).engage(
                (e) => fail(e),
                ({newPrivateKey, augmentationFactor}) => {
                    expect(augmentationFactor).toEqual(expect.any(Buffer));
                    expect(newPrivateKey).toEqual(expect.any(Buffer));
                }
            );
        });
    });

    describe("rotateGroupPrivateKeyWithRetry", () => {
        test("generates new plaintext key and augmentation factor", () => {
            //prettier-ignore
            const currentKey = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);

            Recrypt.rotateGroupPrivateKeyWithRetry(currentKey).engage(
                (e) => fail(e),
                ({plaintext, augmentationFactor}) => {
                    expect(augmentationFactor).toEqual(expect.any(Buffer));
                    expect(plaintext).toEqual(expect.any(Buffer));
                }
            );
        });
    });
});
