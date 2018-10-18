import * as crypto from "crypto";
import * as fs from "fs";
import * as AES from "../AES";
import * as Constants from "../../Constants";
import {StreamingEncryption, StreamingDecryption} from "../StreamingAES";
jest.mock("fs", () => ({
    realpathSync: () => "realpath",
    renameSync: jest.fn(),
    mkdirSync: jest.fn(),
    rmdirSync: jest.fn(),
    createWriteStream: jest.fn(),
}));
jest.mock("../StreamingAES");
jest.mock("crypto");

describe("AES", () => {
    describe("encryptUserMasterKey", () => {
        test("should produce encrypted master with with prepended bytes", (done) => {
            const fixedSalt = Buffer.alloc(Constants.PBKDF2_SALT_LENGTH);
            const hardcodedIV = Buffer.alloc(Constants.AES_IV_LENGTH);
            (crypto as any).__setMockImplementation((size: number) => {
                if (size === Constants.AES_IV_LENGTH) {
                    return hardcodedIV;
                }
                return fixedSalt;
            });
            //Shorten PBKDF2 iterations to prevent long run tests
            const spy = jest.spyOn(Constants, "PBKDF2_ITERATIONS");
            spy.mockImplementation(() => 10);

            const userMasterKey = Buffer.alloc(32);
            AES.encryptUserMasterKey("password", userMasterKey).engage(
                (e) => fail(e),
                (encryptedKey) => {
                    expect(encryptedKey).toHaveLength(92);

                    const salt = encryptedKey.slice(0, Constants.PBKDF2_SALT_LENGTH);
                    const iv = encryptedKey.slice(Constants.PBKDF2_SALT_LENGTH, Constants.PBKDF2_SALT_LENGTH + Constants.AES_IV_LENGTH);
                    const rest = encryptedKey.slice(Constants.PBKDF2_SALT_LENGTH + Constants.AES_IV_LENGTH);

                    expect(salt).toEqual(fixedSalt);
                    expect(iv).toEqual(hardcodedIV);

                    // prettier-ignore
                    expect(rest).toEqual(Buffer.from([49, 191, 153, 35, 146, 175, 185, 201, 167, 137, 84, 197, 161, 94, 39, 227, 183, 112, 16, 118, 27, 12, 85, 220, 106, 190, 230, 169, 135, 47, 110, 134, 20, 138, 30, 29, 101, 253, 217, 163, 139, 242, 197, 234, 205, 181, 126, 178]));

                    (crypto as any).__clearMockImplementation();
                    done();
                }
            );
        });
    });

    describe("decryptUserMasterKey", () => {
        test("should decrypt with expected bytes", (done) => {
            //Shorten PBKDF2 iterations to prevent long run tests
            const spy = jest.spyOn(Constants, "PBKDF2_ITERATIONS");
            spy.mockImplementation(() => 10);

            const fixedSalt = Buffer.alloc(Constants.PBKDF2_SALT_LENGTH);
            const hardcodedIV = Buffer.alloc(Constants.AES_IV_LENGTH);
            // prettier-ignore
            const rest = Buffer.from([49, 191, 153, 35, 146, 175, 185, 201, 167, 137, 84, 197, 161, 94, 39, 227, 183, 112, 16, 118, 27, 12, 85, 220, 106, 190, 230, 169, 135, 47, 110, 134, 20, 138, 30, 29, 101, 253, 217, 163, 139, 242, 197, 234, 205, 181, 126, 178]);

            AES.decryptUserMasterKey("password", Buffer.concat([fixedSalt, hardcodedIV, rest])).engage(
                (e) => fail(e),
                (decrypted) => {
                    expect(decrypted).toEqual(Buffer.alloc(32));
                    done();
                }
            );
        });

        test("should error with expected code when decrypt fails", (done) => {
            //Shorten PBKDF2 iterations to prevent long run tests
            const spy = jest.spyOn(Constants, "PBKDF2_ITERATIONS");
            spy.mockImplementation(() => 10);

            const fixedSalt = Buffer.alloc(Constants.PBKDF2_SALT_LENGTH);
            const hardcodedIV = Buffer.alloc(Constants.AES_IV_LENGTH);
            // prettier-ignore
            const rest = Buffer.from([49, 191, 153, 35, 146, 175, 185, 201, 167, 137, 84, 197, 161, 94, 39, 227, 183, 112, 16, 118, 27, 12, 85, 220, 106, 190, 230, 169, 135, 47, 110, 134, 20, 138, 30, 29, 101, 253, 217, 163, 139, 242, 197, 234, 205, 181, 126, 178]);

            AES.decryptUserMasterKey("password2", Buffer.concat([fixedSalt, hardcodedIV, rest])).engage(
                (e) => {
                    expect(e.code).toEqual(Constants.ErrorCodes.USER_PASSCODE_INCORRECT);
                    done();
                },
                () => {
                    fail("Should not decrypt successfully when wrong password was provided");
                }
            );
        });
    });

    const fixedIV = Buffer.from([50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160]);

    describe("encryptBytes", () => {
        test("encrypts data as expected", (done) => {
            (crypto as any).__setRandomData(fixedIV);
            const data = Buffer.from([52, 98, 35, 13, 83, 95]);
            const key = Buffer.alloc(32);

            AES.encryptBytes(data, key).engage(
                (e) => fail(e),
                (result) => {
                    expect(result).toEqual(
                        Buffer.concat([
                            Buffer.from([1]),
                            fixedIV,
                            Buffer.from([129, 142, 221, 187, 227, 144]), //encrypted data
                            Buffer.from([27, 198, 73, 247, 15, 61, 187, 89, 121, 4, 215, 200, 177, 154, 244, 175]), //gcm tag
                        ])
                    );
                    done();
                }
            );
        });

        test("fails with expected error code", (done) => {
            (crypto as any).__shouldThrow(true);
            AES.encryptBytes(Buffer.alloc(10), Buffer.alloc(32)).engage(
                (e) => {
                    expect(e.code).toEqual(Constants.ErrorCodes.DOCUMENT_ENCRYPT_FAILURE);
                    (crypto as any).__shouldThrow(false);
                    done();
                },
                () => done.fail("Should not resolve when AES encryption throws an error")
            );
        });
    });

    describe("encryptStream", () => {
        let inputFirstPipe: jest.Mock;
        let inputSecondPipe: jest.Mock;
        let mockInputStream: {on: jest.Mock; pipe: jest.Mock};
        let mockOutputStream: {on: jest.Mock};

        beforeEach(() => {
            inputFirstPipe = jest.fn();
            inputSecondPipe = jest.fn();
            inputFirstPipe.mockReturnValue({
                pipe: inputSecondPipe,
            });
            mockInputStream = {
                on: jest.fn(),
                pipe: inputFirstPipe,
            };

            mockOutputStream = {
                on: jest.fn(),
            };
        });

        test("pipes data through encryption stream", (done) => {
            AES.encryptStream(mockInputStream as any, mockOutputStream as any, Buffer.alloc(32)).engage(
                (e) => fail(e.message),
                (result) => {
                    expect(result).toBeUndefined();
                    done();
                }
            );
            expect(StreamingEncryption).toHaveBeenCalledWith(Buffer.alloc(32));
            const streamingEncryptionInstance = (StreamingEncryption as any).mock.instances[0];
            const mockTransform = streamingEncryptionInstance.getEncryptionStream;
            expect(mockTransform).toHaveBeenCalledWith();
            expect(mockInputStream.on).toHaveBeenCalledWith("error", expect.any(Function));
            expect(mockOutputStream.on).toHaveBeenCalledWith("error", expect.any(Function));
            expect(mockOutputStream.on).toHaveBeenCalledWith("finish", expect.any(Function));
            expect(inputFirstPipe).toHaveBeenCalledTimes(1);
            expect(inputSecondPipe).toHaveBeenCalledTimes(1);
            expect(inputSecondPipe).toHaveBeenCalledWith(mockOutputStream);

            //Now get the finish callback and invoke it so our Future above resolves
            const finishCallback = mockOutputStream.on.mock.calls[1][1];
            finishCallback();
        });

        test("fails when input stream throws error", (done) => {
            AES.encryptStream(mockInputStream as any, mockOutputStream as any, Buffer.alloc(32)).engage(
                (e) => {
                    expect(e.message).toEqual("mock input stream failure");
                    expect(e.code).toEqual(Constants.ErrorCodes.DOCUMENT_ENCRYPT_FAILURE);
                    done();
                },
                () => fail("Future should not resolve when input pipe throws an error")
            );

            expect(mockInputStream.on).toHaveBeenCalledWith("error", expect.any(Function));
            const inputStreamFailure = mockInputStream.on.mock.calls[0][1];
            inputStreamFailure(new Error("mock input stream failure"));
        });

        test("fails when output stream throws error", (done) => {
            AES.encryptStream(mockInputStream as any, mockOutputStream as any, Buffer.alloc(32)).engage(
                (e) => {
                    expect(e.message).toEqual("mock output stream failure");
                    expect(e.code).toEqual(Constants.ErrorCodes.DOCUMENT_ENCRYPT_FAILURE);
                    done();
                },
                () => fail("Future should not resolve when input pipe throws an error")
            );

            expect(mockOutputStream.on).toHaveBeenCalledWith("error", expect.any(Function));
            const outputStreamFailure = mockOutputStream.on.mock.calls[0][1];
            outputStreamFailure(new Error("mock output stream failure"));
        });

        test("fails when pipe operation fails", (done) => {
            mockInputStream.pipe.mockImplementation(() => {
                throw new Error("mock pipe failure");
            });

            AES.encryptStream(mockInputStream as any, mockOutputStream as any, Buffer.alloc(32)).engage(
                (e) => {
                    expect(e.message).toEqual("mock pipe failure");
                    expect(e.code).toEqual(Constants.ErrorCodes.DOCUMENT_ENCRYPT_FAILURE);
                    done();
                },
                () => fail("Future should not resolve when input pipe throws an error")
            );
        });
    });

    describe("decryptBytes", () => {
        test("decrypts provided bytes as expected", (done) => {
            const encryptedDoc = Buffer.concat([
                Buffer.from([1]),
                fixedIV,
                Buffer.from([129, 142, 221, 187, 227, 144]),
                Buffer.from([27, 198, 73, 247, 15, 61, 187, 89, 121, 4, 215, 200, 177, 154, 244, 175]),
            ]);

            AES.decryptBytes(encryptedDoc, Buffer.alloc(32)).engage(
                (e) => fail(e),
                (result) => {
                    expect(result).toEqual(Buffer.from([52, 98, 35, 13, 83, 95]));
                    done();
                }
            );
        });

        test("failed decryptBytes", (done) => {
            const spy = jest.spyOn(crypto, "createDecipheriv");
            spy.mockImplementation(() => {
                throw new Error();
            });

            AES.decryptBytes(Buffer.alloc(10), Buffer.alloc(32)).engage(
                (e) => {
                    expect(e.code).toEqual(Constants.ErrorCodes.DOCUMENT_DECRYPT_FAILURE);
                    done();
                },
                () => done.fail("Should not resolve when AES decryption throws an error")
            );
        });
    });

    describe("decryptStream", () => {
        let inputFirstPipe: jest.Mock;
        let inputSecondPipe: jest.Mock;
        let mockInputStream: {on: jest.Mock; pipe: jest.Mock};

        beforeEach(() => {
            inputFirstPipe = jest.fn();
            inputSecondPipe = jest.fn();
            inputFirstPipe.mockReturnValue({
                pipe: inputSecondPipe,
            });
            mockInputStream = {
                on: jest.fn(),
                pipe: inputFirstPipe,
            };
        });

        test("pipes output to temp file and renames on success", (done) => {
            const mockWriteStream = {
                close: jest.fn(),
                on: jest.fn(),
            };
            (fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

            AES.decryptStream(mockInputStream as any, "path/to/outfile", Buffer.alloc(32)).engage(
                (e) => fail(e.message),
                (result) => {
                    expect(result).toBeUndefined();
                    expect(fs.renameSync).toHaveBeenCalledWith(expect.stringContaining("realpath/"), "path/to/outfile");
                    expect(fs.rmdirSync).toHaveBeenCalledWith(expect.stringContaining("realpath/"));
                    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining("realpath/"));
                    done();
                }
            );
            expect(StreamingDecryption).toHaveBeenCalledWith(Buffer.alloc(32));
            const streamingDecryptionInstance = (StreamingDecryption as any).mock.instances[0];
            const mockTransform = streamingDecryptionInstance.getDecryptionStream;
            expect(mockTransform).toHaveBeenCalledWith();
            expect(mockInputStream.on).toHaveBeenCalledWith("error", expect.any(Function));
            expect(mockWriteStream.on).toHaveBeenCalledWith("error", expect.any(Function));
            expect(mockWriteStream.on).toHaveBeenCalledWith("finish", expect.any(Function));
            expect(inputFirstPipe).toHaveBeenCalledTimes(1);
            expect(inputSecondPipe).toHaveBeenCalledTimes(1);
            expect(inputSecondPipe).toHaveBeenCalledWith(mockWriteStream);

            //Now get the finish callback and invoke it so our Future above resolves
            const finishCallback = mockWriteStream.on.mock.calls[1][1];
            finishCallback();
        });

        test("throws error on input stream error", (done) => {
            const mockWriteStream = {
                close: jest.fn(),
                on: jest.fn(),
            };
            (fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

            AES.decryptStream(mockInputStream as any, "path/to/outfile", Buffer.alloc(32)).engage(
                (e) => {
                    expect(e.message).toEqual("mock input stream failure");
                    expect(e.code).toEqual(Constants.ErrorCodes.DOCUMENT_DECRYPT_FAILURE);
                    done();
                },
                () => fail("Should not resolve when input stream fails")
            );

            expect(mockInputStream.on).toHaveBeenCalledWith("error", expect.any(Function));
            const inputStreamFailure = mockInputStream.on.mock.calls[0][1];
            inputStreamFailure(new Error("mock input stream failure"));
        });

        test("throws error on output stream error and closes write stream", (done) => {
            const mockWriteStream = {
                close: jest.fn(),
                on: jest.fn(),
            };
            (fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

            AES.decryptStream(mockInputStream as any, "path/to/outfile", Buffer.alloc(32)).engage(
                (e) => {
                    expect(e.message).toEqual("mock output stream failure");
                    expect(e.code).toEqual(Constants.ErrorCodes.DOCUMENT_DECRYPT_FAILURE);
                    expect(mockWriteStream.close).toHaveBeenCalledWith();
                    done();
                },
                () => fail("Should not resolve when output stream fails")
            );

            expect(mockWriteStream.on).toHaveBeenCalledWith("error", expect.any(Function));
            const outputStreamFailure = mockWriteStream.on.mock.calls[0][1];
            outputStreamFailure(new Error("mock output stream failure"));
        });

        test("throws error on pipe error", (done) => {
            const mockWriteStream = {
                close: jest.fn(),
                on: jest.fn(),
            };
            (fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);
            mockInputStream.pipe.mockImplementation(() => {
                throw new Error("mock pipe failure");
            });

            AES.decryptStream(mockInputStream as any, "path/to/outfile", Buffer.alloc(32)).engage(
                (e) => {
                    expect(e.message).toEqual("mock pipe failure");
                    expect(e.code).toEqual(Constants.ErrorCodes.DOCUMENT_DECRYPT_FAILURE);
                    expect(mockWriteStream.close).toHaveBeenCalledWith();
                    done();
                },
                () => fail("Should not resolve when pipe fails")
            );
        });

        test("throws error on temp file rename", (done) => {
            const mockWriteStream = {
                close: jest.fn(),
                on: jest.fn(),
            };
            (fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);
            (fs.rmdirSync as jest.Mock).mockImplementation(() => {
                throw new Error("rename failure");
            });

            AES.decryptStream(mockInputStream as any, "path/to/outfile", Buffer.alloc(32)).engage(
                (e) => {
                    expect(e.message).toEqual("rename failure");
                    expect(e.code).toEqual(Constants.ErrorCodes.DOCUMENT_DECRYPT_FAILURE);
                    expect(mockWriteStream.close).not.toHaveBeenCalled();
                    done();
                },
                () => fail("Should not resolve when rename operation fails")
            );

            const finishCallback = mockWriteStream.on.mock.calls[1][1];
            finishCallback();
        });
    });

    describe("roundtrip", () => {
        test("is able to decrypt content that is encrypted", (done) => {
            const data = Buffer.from("my secret data");
            const key = Buffer.concat([Buffer.from([93, 34, 23, 52, 81, 103, 233, 200]), Buffer.alloc(24)]);

            AES.encryptBytes(data, key)
                .flatMap((encryptedDoc) => AES.decryptBytes(encryptedDoc, key))
                .engage(
                    (e) => done.fail(e),
                    (result) => {
                        expect(result.toString("utf8")).toEqual("my secret data");
                        done();
                    }
                );
        });
    });
});
