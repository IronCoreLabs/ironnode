import Future from "futurejs";
import * as UserSDK from "../UserSDK";
import * as UserOperations from "../../operations/UserOperations";

describe("UserSDK", () => {
    describe("getPublicKey", () => {
        test("fails if no value provided ", () => {
            expect(() => UserSDK.getPublicKey("")).toThrow();
            expect(() => UserSDK.getPublicKey([])).toThrow();
        });

        test("converts single ID to array and returns value from UserOperations call", (done) => {
            const spy = jest.spyOn(UserOperations, "getUserPublicKeys");
            spy.mockReturnValue(Future.of("resp"));
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
            spy.mockReturnValue(Future.of("resp"));
            UserSDK.getPublicKey(["userID1", "userID2"])
                .then((resp) => {
                    expect(resp).toEqual("resp");
                    expect(UserOperations.getUserPublicKeys).toHaveBeenCalledWith(["userID1", "userID2"]);
                    done();
                })
                .catch((e) => fail(e));
        });
    });
});
