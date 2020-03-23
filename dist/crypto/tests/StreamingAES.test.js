"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const stream_1 = require("stream");
const StreamingAES_1 = require("../StreamingAES");
jest.mock("crypto");
describe("StreamingAES", () => {
    describe("StreamingEncryption", () => {
        describe("getTransform", () => {
            test("should push IV onto stream as first option", () => {
                const fixedIV = Buffer.from([50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160]);
                crypto.__setRandomData(fixedIV);
                const se = new StreamingAES_1.StreamingEncryption(Buffer.from([0, 0, 0, 0]), Buffer.alloc(32));
                expect(se.cipher).not.toBeUndefined();
                expect(se.iv).toEqual(fixedIV);
                expect(se.documentHeader).toEqual(Buffer.from([0, 0, 0, 0]));
                const transformer = se.getTransform();
                const mockTransform = { push: jest.fn() };
                const callback = jest.fn();
                transformer.call(mockTransform, Buffer.from([5, 10, 15, 20, 25, 30]), "", callback);
                expect(mockTransform.push).toHaveBeenCalledWith(Buffer.from([0, 0, 0, 0]));
                expect(mockTransform.push).toHaveBeenCalledWith(fixedIV);
                expect(mockTransform.push).toHaveBeenCalledWith(Buffer.from([176, 230, 241, 162, 169, 209]));
                expect(callback).toHaveBeenCalledWith();
                transformer.call(mockTransform, Buffer.from([]), "", callback);
                expect(mockTransform.push).toHaveBeenCalledTimes(3);
                expect(callback).toHaveBeenCalledTimes(2);
                transformer.call(mockTransform, Buffer.from([88, 92, 3, 35]), "", callback);
                expect(mockTransform.push).toHaveBeenCalledWith(Buffer.from([8, 92, 241, 108]));
                expect(callback).toHaveBeenCalledTimes(3);
            });
        });
        describe("getFlush", () => {
            test("should get AES final and auth tag and add to result", () => {
                const se = new StreamingAES_1.StreamingEncryption(Buffer.from([0, 0, 0, 0]), Buffer.alloc(32));
                se.hasPushedOnIV = true;
                const mockFlush = { push: jest.fn() };
                const callback = jest.fn();
                const finalSpy = jest.spyOn(se.cipher, "final");
                finalSpy.mockReturnValue(Buffer.from([10]));
                const authTagSpy = jest.spyOn(se.cipher, "getAuthTag");
                authTagSpy.mockReturnValue(Buffer.from([30, 40, 50, 60, 70]));
                const flush = se.getFlush();
                flush.call(mockFlush, callback);
                expect(mockFlush.push).toHaveBeenCalledWith(Buffer.from([10, 30, 40, 50, 60, 70]));
                expect(callback).toHaveBeenCalledWith();
            });
            test("should push on header and IV if no data was yet processed", () => {
                const se = new StreamingAES_1.StreamingEncryption(Buffer.from([0, 0, 0, 0]), Buffer.alloc(32));
                const mockFlush = { push: jest.fn() };
                const callback = jest.fn();
                const finalSpy = jest.spyOn(se.cipher, "final");
                finalSpy.mockReturnValue(Buffer.from([10]));
                const authTagSpy = jest.spyOn(se.cipher, "getAuthTag");
                authTagSpy.mockReturnValue(Buffer.from([30, 40, 50, 60, 70]));
                const flush = se.getFlush();
                flush.call(mockFlush, callback);
                expect(mockFlush.push.mock.calls.length).toEqual(3);
                expect(mockFlush.push).toHaveBeenCalledWith(Buffer.from([0, 0, 0, 0]));
                expect(mockFlush.push).toHaveBeenCalledWith(Buffer.from([50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160]));
                expect(mockFlush.push).toHaveBeenCalledWith(Buffer.from([10, 30, 40, 50, 60, 70]));
                expect(callback).toHaveBeenCalledWith();
            });
        });
        describe("getEncryptionStream", () => {
            test("returns expected Transform", () => {
                const se = new StreamingAES_1.StreamingEncryption(Buffer.from([0, 0, 0, 0]), Buffer.alloc(32));
                expect(se.getEncryptionStream()).toBeInstanceOf(stream_1.Transform);
            });
        });
    });
    describe("StreamingDecryption", () => {
        describe("stripAuthTagAndLastAESBlock", () => {
            test("should return last 32 bytes of data provided", () => {
                const sd = new StreamingAES_1.StreamingDecryption(Buffer.alloc(32));
                const fullChunk = Buffer.from([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180]);
                const [lastBytes, chunk] = sd.stripAuthTagAndLastAESBlock(sd.authTagAndLastBlock, fullChunk);
                expect(lastBytes).toEqual(Buffer.from([20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180]));
                expect(chunk).toEqual(Buffer.from([0, 5, 10, 15]));
            });
            test("should build up size if not given enough bytes", () => {
                const sd = new StreamingAES_1.StreamingDecryption(Buffer.alloc(32));
                const partialChunk = Buffer.from([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]);
                const [firstLastBytes, chunkOne] = sd.stripAuthTagAndLastAESBlock(sd.authTagAndLastBlock, partialChunk);
                expect(firstLastBytes).toEqual(partialChunk);
                expect(chunkOne).toEqual(Buffer.alloc(0));
                const secondPartial = Buffer.from([105, 110, 115, 120, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180, 185, 190, 195, 200]);
                const [secondLastBytes, chunkTwo] = sd.stripAuthTagAndLastAESBlock(firstLastBytes, secondPartial);
                expect(secondLastBytes).toEqual(Buffer.from([40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180, 185, 190, 195, 200]));
                expect(chunkTwo).toEqual(Buffer.from([0, 5, 10, 15, 20, 25, 30, 35]));
            });
            test("should build up last tag over repeated calls", () => {
                const sd = new StreamingAES_1.StreamingDecryption(Buffer.alloc(32));
                const firstChunk = Buffer.from([0, 5, 10, 15, 20, 25, 30, 35, 40]);
                const [firstFinalBytes, chunkOne] = sd.stripAuthTagAndLastAESBlock(sd.authTagAndLastBlock, firstChunk);
                expect(firstFinalBytes).toEqual(firstChunk);
                expect(chunkOne).toEqual(Buffer.alloc(0));
                const secondChunk = Buffer.from([45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115]);
                const [secondFinalBytes, chunkTwo] = sd.stripAuthTagAndLastAESBlock(firstFinalBytes, secondChunk);
                expect(secondFinalBytes).toEqual(Buffer.from([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115]));
                expect(chunkTwo).toEqual(Buffer.alloc(0));
                const thirdChunk = Buffer.alloc(0);
                const [thirdFinalBytes, chunkThree] = sd.stripAuthTagAndLastAESBlock(secondFinalBytes, thirdChunk);
                expect(thirdFinalBytes).toEqual(Buffer.from([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115]));
                expect(chunkThree).toEqual(Buffer.alloc(0));
                const fourthChunk = Buffer.from([120, 130, 135, 140, 145, 150, 155, 160]);
                const [fourthFinalBytes, chunkFour] = sd.stripAuthTagAndLastAESBlock(thirdFinalBytes, fourthChunk);
                expect(fourthFinalBytes).toEqual(Buffer.from([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 130, 135, 140, 145, 150, 155, 160]));
                expect(chunkFour).toEqual(Buffer.alloc(0));
                const fifthChunk = Buffer.from([165, 170, 175, 180]);
                const [fifthFinalBytes, chunkFive] = sd.stripAuthTagAndLastAESBlock(fourthFinalBytes, fifthChunk);
                expect(fifthFinalBytes).toEqual(Buffer.from([20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180]));
                expect(chunkFive).toEqual(Buffer.from([0, 5, 10, 15]));
            });
        });
        describe("pullIVFromFrontOfBytes", () => {
            test("should pull full IV from bytes if available", () => {
                const sd = new StreamingAES_1.StreamingDecryption(Buffer.alloc(32));
                const fullChunk = Buffer.from([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85]);
                const [iv, chunk] = sd.pullIVFromFrontOfBytes(sd.iv, fullChunk);
                expect(iv).toEqual(Buffer.from([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]));
                expect(chunk).toEqual(Buffer.from([65, 70, 75, 80, 85]));
            });
            test("should fill up IV with bytes if sizes are smaller", () => {
                const sd = new StreamingAES_1.StreamingDecryption(Buffer.alloc(32));
                const firstChunk = Buffer.from([5, 10]);
                const [ivOne, chunkOne] = sd.pullIVFromFrontOfBytes(sd.iv, firstChunk);
                expect(ivOne).toEqual(firstChunk);
                expect(chunkOne).toEqual(Buffer.alloc(0));
                const secondChunk = Buffer.from([15, 20, 25, 30, 35]);
                const [ivTwo, chunkTwo] = sd.pullIVFromFrontOfBytes(ivOne, secondChunk);
                expect(ivTwo).toEqual(Buffer.from([5, 10, 15, 20, 25, 30, 35]));
                expect(chunkTwo).toEqual(Buffer.alloc(0));
                const thirdChunk = Buffer.alloc(0);
                const [ivThree, chunkThree] = sd.pullIVFromFrontOfBytes(ivTwo, thirdChunk);
                expect(ivThree).toEqual(Buffer.from([5, 10, 15, 20, 25, 30, 35]));
                expect(chunkThree).toEqual(Buffer.alloc(0));
                const fourthChunk = Buffer.from([40, 45, 50, 55, 60]);
                const [ivFour, chunkFour] = sd.pullIVFromFrontOfBytes(ivThree, fourthChunk);
                expect(ivFour).toEqual(Buffer.from([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]));
                expect(chunkFour).toEqual(Buffer.alloc(0));
                const fifthChunk = Buffer.from([65]);
                const [ivFive, chunkFive] = sd.pullIVFromFrontOfBytes(ivFour, fifthChunk);
                expect(ivFive).toEqual(Buffer.from([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]));
                expect(chunkFive).toEqual(Buffer.from([65]));
            });
        });
        describe("getTransform", () => {
            test("does nothing when no data provided", () => {
                const sd = new StreamingAES_1.StreamingDecryption(Buffer.alloc(32));
                const callback = jest.fn();
                const mockTransform = { push: jest.fn() };
                const transform = sd.getTransform();
                transform.call(mockTransform, Buffer.from([]), "", callback);
                expect(callback).toHaveBeenCalled();
                expect(mockTransform.push).not.toHaveBeenCalled();
            });
            test("it doesnt push on any data when IV is not yet pulled off", () => {
                const sd = new StreamingAES_1.StreamingDecryption(Buffer.alloc(32));
                const callback = jest.fn();
                const mockTransform = { push: jest.fn() };
                const transform = sd.getTransform();
                transform.call(mockTransform, Buffer.from([1, 10, 20, 30, 40, 50, 60, 70]), "", callback);
                expect(callback).toHaveBeenCalledWith();
                expect(mockTransform.push).not.toHaveBeenCalled();
                expect(sd.iv).toEqual(Buffer.from([10, 20, 30, 40, 50, 60, 70]));
                expect(sd.decipher).toBeUndefined();
                transform.call(mockTransform, Buffer.from([80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200]), "", callback);
                expect(sd.iv).toEqual(Buffer.from([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]));
                expect(sd.decipher).not.toBeUndefined();
                expect(sd.authTagAndLastBlock).toEqual(Buffer.from([130, 140, 150, 160, 170, 180, 190, 200]));
                expect(mockTransform.push).not.toHaveBeenCalled();
                expect(callback).toHaveBeenCalledTimes(2);
            });
            test("pushes on data that it has decrypted", () => {
                const sd = new StreamingAES_1.StreamingDecryption(Buffer.alloc(32));
                const callback = jest.fn();
                const mockTransform = { push: jest.fn() };
                const transform = sd.getTransform();
                const iv = Buffer.alloc(12);
                const chunk = Buffer.from([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180]);
                transform.call(mockTransform, Buffer.concat([Buffer.from([1]), iv, chunk]), "", callback);
                expect(sd.iv).toEqual(iv);
                expect(sd.decipher).not.toBeUndefined();
                expect(sd.authTagAndLastBlock).toEqual(Buffer.from([20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180]));
                expect(callback).toHaveBeenCalledWith();
                expect(mockTransform.push).toHaveBeenCalledWith(Buffer.from([206, 162, 74, 50]));
                const chunk2 = Buffer.from([190, 200, 210, 220, 230, 240, 250]);
                transform.call(mockTransform, chunk2, "", callback);
                expect(sd.iv).toEqual(iv);
                expect(sd.authTagAndLastBlock).toEqual(Buffer.from([55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180, 190, 200, 210, 220, 230, 240, 250]));
                expect(callback).toHaveBeenCalledTimes(2);
                expect(mockTransform.push).toHaveBeenCalledWith(Buffer.from([89, 121, 117, 77, 47, 99, 247]));
            });
        });
        describe("getFlush", () => {
            test("should throw an error if we havent gotten any data in the transformer yet", () => {
                const sd = new StreamingAES_1.StreamingDecryption(Buffer.alloc(32));
                const callback = jest.fn();
                const mockTransform = { push: jest.fn() };
                const flush = sd.getFlush();
                flush.call(mockTransform, callback);
                expect(callback).toHaveBeenCalledWith(expect.any(Error));
            });
            test("should throw an error if data we got from the stream is the wrong size", () => {
                const sd = new StreamingAES_1.StreamingDecryption(Buffer.alloc(32));
                sd.decipher = { foo: "bar" };
                sd.authTagAndLastBlock = Buffer.from([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]);
                const flush = sd.getFlush();
                const callback = jest.fn();
                flush.call({ push: jest.fn() }, callback);
                expect(callback).toHaveBeenCalledWith(expect.any(Error));
            });
            test("sets auth tag before doing final AES data update", () => {
                const sd = new StreamingAES_1.StreamingDecryption(Buffer.alloc(32));
                const callback = jest.fn();
                const mockTransform = { push: jest.fn() };
                const mockFlush = { push: jest.fn() };
                const transform = sd.getTransform();
                const flush = sd.getFlush();
                const ivAndData = Buffer.alloc(50);
                const finalBytes = Buffer.from([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 130, 135, 140, 145, 150, 155, 160]);
                transform.call(mockTransform, Buffer.concat([Buffer.from([1]), ivAndData, finalBytes]), "", jest.fn());
                jest.spyOn(sd.decipher, "setAuthTag");
                const finalSpy = jest.spyOn(sd.decipher, "final");
                finalSpy.mockReturnValue(Buffer.from([100]));
                flush.call(mockFlush, callback);
                expect(sd.decipher.setAuthTag).toHaveBeenCalledWith(Buffer.from([80, 85, 90, 95, 100, 105, 110, 115, 120, 130, 135, 140, 145, 150, 155, 160]));
                expect(mockFlush.push).toHaveBeenCalledWith(Buffer.from([225, 126, 75, 231, 77, 61, 89, 47, 30, 218, 117, 118, 247, 160, 199, 240, 100]));
                expect(callback).toHaveBeenCalledWith();
            });
        });
        describe("getDecryptionStream", () => {
            test("returns expected Transform", () => {
                const sd = new StreamingAES_1.StreamingDecryption(Buffer.alloc(32));
                expect(sd.getDecryptionStream()).toBeInstanceOf(stream_1.Transform);
            });
        });
    });
});
