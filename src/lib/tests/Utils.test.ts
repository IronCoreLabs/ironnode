import * as Utils from "../Utils";
import * as TestUtils from "../../tests/TestUtils";

describe("Utils", () => {
    describe("Codec", () => {
        describe("Buffer", () => {
            test("toBase64", () => {
                expect(Utils.Codec.Buffer.toBase64(Buffer.from([99, 103, 53, 13]))).toEqual("Y2c1DQ==");
            });

            test("fromBase64", () => {
                expect(Utils.Codec.Buffer.fromBase64("d2h5")).toEqual(Buffer.from([119, 104, 121]));
            });

            test("fromTypedArray", () => {
                expect(Utils.Codec.Buffer.fromTypedArray(new Uint8Array([35, 2, 93]))).toEqual(Buffer.from([35, 2, 93]));
            });
        });

        describe("PublicKey", () => {
            test("fromBase64", () => {
                expect(
                    Utils.Codec.PublicKey.fromBase64({
                        x: "YXNhc2Vn",
                        y: "ZXNhZXQjJQ==",
                    })
                ).toEqual({
                    x: Buffer.from([97, 115, 97, 115, 101, 103]),
                    y: Buffer.from([101, 115, 97, 101, 116, 35, 37]),
                });
            });

            test("toBase64", () => {
                expect(
                    Utils.Codec.PublicKey.toBase64({
                        x: Buffer.from([97, 115, 97, 115, 101, 103]),
                        y: Buffer.from([101, 115, 97, 101, 116, 35, 37]),
                    })
                ).toEqual({
                    x: "YXNhc2Vn",
                    y: "ZXNhZXQjJQ==",
                });
            });
        });
    });

    describe("transformKeyToBase64", () => {
        test("converts transformkey into base64 content", () => {
            const transformKey = {
                ephemeralPublicKey: TestUtils.getEmptyPublicKey(),
                toPublicKey: TestUtils.getEmptyPublicKey(),
                encryptedTempKey: Buffer.from([99]),
                hashedTempKey: Buffer.from([100]),
                publicSigningKey: Buffer.from([101]),
                signature: Buffer.from([102]),
            };

            expect(Utils.transformKeyToBase64(transformKey)).toEqual({
                ephemeralPublicKey: {
                    x: "",
                    y: "",
                },
                toPublicKey: {
                    x: "",
                    y: "",
                },
                encryptedTempKey: "Yw==",
                hashedTempKey: "ZA==",
                publicSigningKey: "ZQ==",
                signature: "Zg==",
            });
        });
    });

    describe("dedupeArray", () => {
        test("does nothing with arrays without duplicates", () => {
            expect(Utils.dedupeArray(["a"])).toEqual(["a"]);
            expect(Utils.dedupeArray(["a", "b"])).toEqual(["a", "b"]);
            expect(Utils.dedupeArray(["a", "A"])).toEqual(["a", "A"]);
            expect(Utils.dedupeArray(["A", "a"])).toEqual(["A", "a"]);
            expect(Utils.dedupeArray(["A", ""])).toEqual(["A", ""]);
        });

        test("removes duplicates correctly", () => {
            expect(Utils.dedupeArray(["A", "A"])).toEqual(["A"]);
            expect(Utils.dedupeArray(["A", "A", "A", "A", "A", "A"])).toEqual(["A"]);
            expect(Utils.dedupeArray(["A", "B", "C", "C", "B", "A"])).toEqual(["A", "B", "C"]);
            expect(Utils.dedupeArray(["", "", ""])).toEqual([""]);
        });

        test("clears out empty values when asked to", () => {
            expect(Utils.dedupeArray([""], true)).toEqual([]);
            expect(Utils.dedupeArray(["", "", "", ""], true)).toEqual([]);
        });
    });

    describe("validateID", () => {
        test("fails when ID is not a string with length", () => {
            expect(() => Utils.validateID(3 as any)).toThrow();
            expect(() => Utils.validateID(null as any)).toThrow();
            expect(() => Utils.validateID([] as any)).toThrow();
            expect(() => Utils.validateID(["id-12"] as any)).toThrow();
            expect(() => Utils.validateID("")).toThrow();
        });

        test("does not throw when ID looks valid", () => {
            expect(() => Utils.validateID("12")).not.toThrow();
        });
    });

    describe("validateIDWithSeperators", () => {
        test("validates non strings and empty strings", () => {
            expect(() => Utils.validateIDWithSeperators(3 as any)).toThrow();
            expect(() => Utils.validateIDWithSeperators(null as any)).toThrow();
            expect(() => Utils.validateIDWithSeperators([] as any)).toThrow();
            expect(() => Utils.validateIDWithSeperators(["id-12"] as any)).toThrow();
            expect(() => Utils.validateIDWithSeperators("")).toThrow();
        });

        test("validates that ID does not contain commas", () => {
            expect(() => Utils.validateIDWithSeperators(",")).toThrow();
            expect(() => Utils.validateIDWithSeperators("abceaf,aseg")).toThrow();
        });

        test("does not throw on valid IDs", () => {
            expect(() => Utils.validateIDWithSeperators("abceafaseg")).not.toThrow();
            expect(() => Utils.validateIDWithSeperators("~`!@#$%^&*()-_=+[{]};:'<.>/?|\"")).not.toThrow();
        });
    });

    describe("validateDocumentData", () => {
        test("fails when data is not a string or byte array", () => {
            expect(() => Utils.validateDocumentData([] as any)).toThrow();
            expect(() => Utils.validateDocumentData({} as any)).toThrow();
            expect(() => Utils.validateDocumentData(10 as any)).toThrow();
            expect(() => Utils.validateDocumentData("content" as any)).toThrow();
            expect(() => Utils.validateDocumentData(Buffer.from([]))).toThrow();
        });

        test("does not throw when data looks valid", () => {
            expect(() => Utils.validateDocumentData(Buffer.from([35, 23, 32, 53]))).not.toThrow();
        });
    });

    describe("validateEncryptedDocument", () => {
        test("fails when argument looks invalid", () => {
            expect(() => Utils.validateEncryptedDocument({} as any)).toThrow();
            expect(() => Utils.validateEncryptedDocument({foo: "bar"} as any)).toThrow();
            expect(() => Utils.validateEncryptedDocument(Buffer.alloc(10) as any)).toThrow();
            expect(() => Utils.validateEncryptedDocument([] as any)).toThrow();
        });

        test("fails when data is not of proper length", () => {
            expect(() => Utils.validateEncryptedDocument(Buffer.alloc(0))).toThrow();
            expect(() => Utils.validateEncryptedDocument(Buffer.alloc(10))).toThrow();
            expect(() => Utils.validateEncryptedDocument(Buffer.alloc(28))).toThrow();
        });

        test("does not throw when data looks valid", () => {
            expect(() => Utils.validateEncryptedDocument(Buffer.alloc(29))).not.toThrow();
        });
    });

    describe("validateAccessList", () => {
        test("fails when no user or group list", () => {
            expect(() => Utils.validateAccessList({} as any)).toThrow();
            expect(() => Utils.validateAccessList({users: 3} as any)).toThrow();
            expect(() => Utils.validateAccessList({users: null} as any)).toThrow();
            expect(() => Utils.validateAccessList({users: []} as any)).toThrow();

            expect(() => Utils.validateAccessList({groups: 3} as any)).toThrow();
            expect(() => Utils.validateAccessList({groups: null} as any)).toThrow();
            expect(() => Utils.validateAccessList({groups: []} as any)).toThrow();
        });

        test("does not throw when user list provided", () => {
            expect(() => Utils.validateAccessList({users: [{id: "35"}, {id: "33"}]})).not.toThrow();
        });

        test("does not throw when group list provided", () => {
            expect(() => Utils.validateAccessList({groups: [{id: "35"}, {id: "33"}]})).not.toThrow();
            expect(() => Utils.validateAccessList({groups: [{id: "35"}, {id: "33"}], users: [{id: "11"}, {id: "80"}]})).not.toThrow();
        });
    });

    describe("validateIDList", () => {
        test("fails when data is not an array or has no length", () => {
            expect(() => Utils.validateIDList({} as any)).toThrow();
            expect(() => Utils.validateIDList("35" as any)).toThrow();
            expect(() => Utils.validateIDList(3 as any)).toThrow();
            expect(() => Utils.validateIDList([] as any)).toThrow();
        });

        test("does not throw when data looks valid", () => {
            expect(() => Utils.validateIDList(["12"])).not.toThrow();
            expect(() => Utils.validateIDList(["12", "35", "11"])).not.toThrow();
        });
    });

    describe("dedupeAccessLists", () => {
        test("dedupes values in both user and group arrays", () => {
            const accessList = {
                users: [{id: "5"}, {id: "8"}, {id: "5"}, {id: "13"}],
                groups: [{id: "35"}, {id: "11"}, {id: "11"}, {id: "35"}, {id: "83"}],
            };

            expect(Utils.dedupeAccessLists(accessList)).toEqual([["5", "8", "13"], ["35", "11", "83"]]);
        });

        test("returns empty arrays for users if not provided", () => {
            const accessList = {
                groups: [{id: "35"}, {id: "11"}, {id: "11"}, {id: "35"}, {id: "83"}],
            };

            expect(Utils.dedupeAccessLists(accessList)).toEqual([[], ["35", "11", "83"]]);
        });

        test("returns empty arrays for groups if not provided", () => {
            const accessList = {
                users: [{id: "5"}, {id: "8"}, {id: "5"}, {id: "13"}],
                groups: [],
            };

            expect(Utils.dedupeAccessLists(accessList)).toEqual([["5", "8", "13"], []]);
        });
    });

    describe("generateDocumentHeaderBytes", () => {
        test("returns header with version byte and encoded metdata", () => {
            const versionHeader = Utils.generateDocumentHeaderBytes("docID", 353);
            expect(versionHeader).toBeInstanceOf(Buffer);
            expect(versionHeader).toHaveLength(32);
            expect(versionHeader[0]).toEqual(2); //Version byte
            expect(versionHeader[1]).toEqual(0); //Two encoded JSON length bytes
            expect(versionHeader[2]).toEqual(29);
            const header = JSON.parse(versionHeader.slice(3).toString());
            expect(header).toEqual({
                _did_: "docID",
                _sid_: 353,
            });
        });
    });
});
