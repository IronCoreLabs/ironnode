import Future from "futurejs";
import * as UserOperations from "../../operations/UserOperations";
import * as UserSDK from "../UserSDK";

describe("UserSDK", () => {
    describe("getPublicKey", () => {
        test("fails if no value provided ", () => {
            expect(() => UserSDK.getPublicKey("")).toThrow();
            expect(() => UserSDK.getPublicKey([])).toThrow();
        });

        test("converts single ID to array and returns value from UserOperations call", (done) => {
            const spy = jest.spyOn(UserOperations, "getUserPublicKeys");
            spy.mockReturnValue(Future.of("resp") as any);
            UserSDK.getPublicKey("userID")
                .then((resp) => {
                    expect(resp).toEqual("resp");
                    expect(UserOperations.getUserPublicKeys).toHaveBeenCalledWith(["userID"]);
                    done();
                })
                .catch((e) => fail(e));
        });

        test("leaves provided arrays alone", (done) => {
            const spy = jest.spyOn(UserOperations, "getUserPublicKeys");
            spy.mockReturnValue(Future.of("resp") as any);
            UserSDK.getPublicKey(["userID1", "userID2"])
                .then((resp) => {
                    expect(resp).toEqual("resp");
                    expect(UserOperations.getUserPublicKeys).toHaveBeenCalledWith(["userID1", "userID2"]);
                    done();
                })
                .catch((e) => fail(e));
        });
    });

    describe("listDevices", () => {
        test("calls user operations", () => {
            const spy = jest.spyOn(UserOperations, "getUserDevices");
            spy.mockReturnValue(Future.of("resp") as any);
            UserSDK.listDevices()
                .then((resp) => {
                    expect(resp).toEqual("resp");
                    expect(UserOperations.getUserDevices).toHaveBeenCalledWith();
                })
                .catch((e) => fail(e));
        });
    });

    describe("deleteDevice", () => {
        test("fails when device ID isnt provided or isnt a number", () => {
            expect(() => (UserSDK as any).deleteDevice()).toThrow();
            expect(() => (UserSDK as any).deleteDevice("35")).toThrow();
            expect(() => (UserSDK as any).deleteDevice([])).toThrow();
        });

        test("calls user operations method with device ID", () => {
            const spy = jest.spyOn(UserOperations, "deleteUserDevice");
            spy.mockReturnValue(Future.of("resp") as any);
            UserSDK.deleteDevice(34)
                .then((resp) => {
                    expect(resp).toEqual("resp");
                    expect(UserOperations.deleteUserDevice).toHaveBeenCalledWith(34);
                })
                .catch((e) => fail(e));
        });
    });

    describe("rotateMasterKey", () => {
        test("should call into UserOperations", () => {
            const spy = jest.spyOn(UserOperations, "rotateMasterKey");
            spy.mockReturnValue(Future.of("resp") as any);
            UserSDK.rotateMasterKey("password")
                .then((resp) => {
                    expect(resp).toEqual("resp");
                    expect(UserOperations.rotateMasterKey).toHaveBeenCalledWith("password");
                })
                .catch((e) => fail(e));
        });
    });

    describe("changePassword", () => {
        test("should call into UserOperations", () => {
            const spy = jest.spyOn(UserOperations, "changeUsersPassword");
            spy.mockReturnValue(Future.of("resp") as any);
            UserSDK.changePassword("password", "newPassword")
                .then((resp) => {
                    expect(resp).toEqual("resp");
                })
                .catch((e) => fail(e));
        });
    });
});
