import UserApi from "../UserApi";
import * as TestUtils from "../../tests/TestUtils";
import * as ApiRequest from "../ApiRequest";
import Future from "futurejs";
import ApiState from "../../lib/ApiState";

describe("UserApi", () => {
    beforeEach(() => {
        jest.spyOn(ApiRequest, "fetchJSON").mockReturnValue(
            Future.of({
                foo: "bar",
            })
        );
        return ApiState.setAccountContext(
            TestUtils.testAccountID,
            TestUtils.testSegmentID,
            TestUtils.accountPublicBytes,
            TestUtils.devicePrivateBytes,
            TestUtils.signingPrivateBytes
        );
    });

    afterEach(() => {
        (ApiRequest.fetchJSON as jest.Mock).mockClear();
    });

    describe("getAccountContextPublicKey", () => {
        test("calls API and returns data for provided user", (done) => {
            (ApiRequest.fetchJSON as jest.Mock).mockReturnValue(
                Future.of({
                    result: [{id: "svc-user", userMasterPublicKey: {x: ""}}],
                })
            );

            const signingPrivateKey = TestUtils.signingPrivateBytes.toString("base64");

            UserApi.getAccountContextPublicKey("svc-user", 10, signingPrivateKey).engage(
                (error) => done.fail(error),
                (userList: any) => {
                    expect(userList).toEqual({
                        result: [{id: "svc-user", userMasterPublicKey: {x: ""}}],
                    });

                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("users?id=svc-user", jasmine.any(Number), jasmine.any(Object));
                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                    done();
                }
            );
        });
    });

    describe("callUserVerifyApi", () => {
        test("calls API and returns user", (done) => {
            (ApiRequest.fetchJSON as jest.Mock).mockReturnValue(
                Future.of({
                    id: "abbc",
                    segmentId: 22,
                })
            );

            UserApi.callUserVerifyApi("jwt").engage(
                (e) => fail(e),
                (result) => {
                    expect(result).toEqual({
                        id: "abbc",
                        segmentId: 22,
                    });

                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("users/verify?returnKeys=true", jasmine.any(Number), jasmine.any(Object));
                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(request.headers.Authorization).toEqual("jwt jwt");
                    done();
                }
            );
        });

        test("calls API and returns undefined if the user doesnt exist", (done) => {
            (ApiRequest.fetchJSON as jest.Mock).mockReturnValue(Future.of(null));

            UserApi.callUserVerifyApi("jwt").engage(
                (e) => fail(e),
                (result) => {
                    expect(result).toBeUndefined();
                    done();
                }
            );
        });
    });

    describe("callUserCreateApi", () => {
        test("calls API and returns mapped response data", (done) => {
            (ApiRequest.fetchJSON as jest.Mock).mockReturnValue(
                Future.of({
                    id: "abbc",
                    segmentId: 22,
                })
            );

            UserApi.callUserCreateApi("jwt", TestUtils.getEmptyPublicKey(), Buffer.alloc(5)).engage(
                (e) => fail(e),
                (result) => {
                    expect(result).toEqual({
                        id: "abbc",
                        segmentId: 22,
                    });
                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("users", jasmine.any(Number), jasmine.any(Object));
                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(request.headers.Authorization).toEqual("jwt jwt");
                    expect(request.method).toEqual("POST");
                    expect(JSON.parse(request.body)).toEqual({
                        userPrivateKey: "AAAAAAA=",
                        userPublicKey: {x: "", y: ""},
                    });
                    done();
                }
            );
        });
    });

    describe("callUserDeviceAdd", () => {
        test("calls API and returns mapped response data", (done) => {
            (ApiRequest.fetchJSON as jest.Mock).mockReturnValue(
                Future.of({
                    devicePublicKey: {x: "", y: ""},
                })
            );

            UserApi.callUserDeviceAdd("jwt", TestUtils.getEmptyPublicKey(), TestUtils.getTransformKey(), Buffer.from([99, 103, 113, 93]), 133353523, {
                deviceName: "blah",
            }).engage(
                (e) => fail(e),
                (result) => {
                    expect(result).toEqual({
                        devicePublicKey: {x: "", y: ""},
                    });
                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("users/devices", jasmine.any(Number), jasmine.any(Object));
                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(request.headers.Authorization).toEqual("jwt jwt");
                    expect(request.method).toEqual("POST");
                    expect(JSON.parse(request.body)).toEqual({
                        timestamp: 133353523,
                        userPublicKey: {x: "", y: ""},
                        device: {
                            transformKey: {
                                ephemeralPublicKey: {x: "", y: ""},
                                toPublicKey: {x: "", y: ""},
                                encryptedTempKey: "",
                                hashedTempKey: "",
                                publicSigningKey: "",
                                signature: "",
                            },
                            name: "blah",
                        },
                        signature: "Y2dxXQ==",
                    });
                    done();
                }
            );
        });

        test("shouldnt pass device name if not provided", (done) => {
            (ApiRequest.fetchJSON as jest.Mock).mockReturnValue(
                Future.of({
                    devicePublicKey: {x: "", y: ""},
                })
            );

            UserApi.callUserDeviceAdd("jwt", TestUtils.getEmptyPublicKey(), TestUtils.getTransformKey(), Buffer.from([99, 103, 113, 93]), 133353523, {
                deviceName: "",
            }).engage(
                (e) => fail(e),
                () => {
                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(JSON.parse(request.body)).toEqual({
                        timestamp: 133353523,
                        userPublicKey: {x: "", y: ""},
                        device: {
                            transformKey: {
                                ephemeralPublicKey: {x: "", y: ""},
                                toPublicKey: {x: "", y: ""},
                                encryptedTempKey: "",
                                hashedTempKey: "",
                                publicSigningKey: "",
                                signature: "",
                            },
                        },
                        signature: "Y2dxXQ==",
                    });
                    done();
                }
            );
        });
    });

    describe("callUserKeyListApi", () => {
        test("calls API and returns mapped response data", (done) => {
            (ApiRequest.fetchJSON as jest.Mock).mockReturnValue(
                Future.of({
                    result: [{id: "user-10", userMasterPublicKey: {x: ""}}, {id: "user-20", userMasterPublicKey: {x: ""}}],
                })
            );

            UserApi.callUserKeyListApi(["user-10", "user-20"]).engage(
                (error) => done.fail(error),
                (userList: any) => {
                    expect(userList).toEqual({
                        result: [{id: "user-10", userMasterPublicKey: {x: ""}}, {id: "user-20", userMasterPublicKey: {x: ""}}],
                    });

                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith("users?id=user-10,user-20", jasmine.any(Number), jasmine.any(Object));
                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                    done();
                }
            );
        });

        test("returns empty result when no keys provided", (done) => {
            UserApi.callUserKeyListApi([]).engage(
                (e) => done.fail(e),
                (result) => {
                    expect(result).toEqual({result: []});
                    expect(ApiRequest.fetchJSON).not.toHaveBeenCalled();
                    done();
                }
            );
        });
    });

    describe("callUserDeviceListApi", () => {
        test("calls API and returns response", (done) => {
            const deviceListResult = {
                result: [{id: 35, name: "device1", created: 123, updated: 345}, {id: 83, name: "device2", created: 678, updated: 901}],
            };
            (ApiRequest.fetchJSON as jest.Mock).mockReturnValue(Future.of(deviceListResult));

            UserApi.callUserDeviceListApi().engage(
                (error) => done.fail(error),
                (deviceList: any) => {
                    expect(deviceList).toEqual(deviceListResult);
                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith(`users/${TestUtils.testAccountID}/devices`, jasmine.any(Number), jasmine.any(Object));
                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                    done();
                }
            );
        });
    });

    describe("callUserDeviceDeleteApi", () => {
        test("calls delete API and returns response", (done) => {
            const deviceDeleteResult = {id: 35352};
            (ApiRequest.fetchJSON as jest.Mock).mockReturnValue(Future.of(deviceDeleteResult));

            UserApi.callUserDeviceDeleteApi(35352).engage(
                (error) => done.fail(error),
                (deletedDevice: any) => {
                    expect(deletedDevice).toEqual(deviceDeleteResult);
                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith(
                        `users/${TestUtils.testAccountID}/devices/35352`,
                        jasmine.any(Number),
                        jasmine.any(Object)
                    );
                    const request = (ApiRequest.fetchJSON as jest.Mock).mock.calls[0][2];
                    expect(request.headers.Authorization).toMatch(/IronCore\s{1}\d{1}[.][a-zA-Z0-9=\/+]+[.][a-zA-Z0-9=\/+]+/);
                    expect(request.method).toEqual("DELETE");
                    done();
                }
            );
        });

        test("deletes the current device if no ID provided", (done) => {
            const deviceDeleteResult = {id: 35352};
            (ApiRequest.fetchJSON as jest.Mock).mockReturnValue(Future.of(deviceDeleteResult));

            UserApi.callUserDeviceDeleteApi().engage(
                (error) => done.fail(error),
                (deletedDevice: any) => {
                    expect(deletedDevice).toEqual(deviceDeleteResult);
                    expect(ApiRequest.fetchJSON).toHaveBeenCalledWith(
                        `users/${TestUtils.testAccountID}/devices/current`,
                        jasmine.any(Number),
                        jasmine.any(Object)
                    );
                    done();
                }
            );
        });
    });
});
