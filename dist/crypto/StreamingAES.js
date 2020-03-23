"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const stream_1 = require("stream");
const Constants_1 = require("../Constants");
class StreamingEncryption {
    constructor(documentHeader, aesKey) {
        this.hasPushedOnIV = false;
        this.documentHeader = documentHeader;
        this.iv = crypto.randomBytes(Constants_1.AES_IV_LENGTH);
        this.cipher = crypto.createCipheriv(Constants_1.AES_ALGORITHM, aesKey, this.iv);
    }
    getTransform() {
        const streamClass = this;
        return function transform(chunk, _, callback) {
            if (!streamClass.hasPushedOnIV) {
                streamClass.hasPushedOnIV = true;
                this.push(streamClass.documentHeader);
                this.push(streamClass.iv);
            }
            if (chunk.length) {
                this.push(streamClass.cipher.update(chunk));
            }
            callback();
        };
    }
    getFlush() {
        const streamClass = this;
        return function flush(callback) {
            if (!streamClass.hasPushedOnIV) {
                this.push(streamClass.documentHeader);
                this.push(streamClass.iv);
            }
            this.push(Buffer.concat([streamClass.cipher.final(), streamClass.cipher.getAuthTag()]));
            callback();
        };
    }
    getEncryptionStream() {
        return new stream_1.Transform({
            transform: this.getTransform(),
            flush: this.getFlush(),
        });
    }
}
exports.StreamingEncryption = StreamingEncryption;
class StreamingDecryption {
    constructor(aesKey) {
        this.iv = Buffer.alloc(0);
        this.hasStrippedOffVersionHeader = false;
        this.authTagAndLastBlock = Buffer.alloc(0);
        this.aesKey = aesKey;
    }
    stripAuthTagAndLastAESBlock(currentLastBytes, decryptionChunk) {
        const totalTrailingChunkSize = Constants_1.AES_BLOCK_SIZE + Constants_1.AES_GCM_TAG_LENGTH;
        const currentFullChunk = Buffer.concat([currentLastBytes, decryptionChunk]);
        if (currentFullChunk.length > totalTrailingChunkSize) {
            return [currentFullChunk.slice(-totalTrailingChunkSize), currentFullChunk.slice(0, -totalTrailingChunkSize)];
        }
        return [currentFullChunk, Buffer.alloc(0)];
    }
    pullIVFromFrontOfBytes(currentIV, chunk) {
        const remainingBytesNeeded = Constants_1.AES_IV_LENGTH - currentIV.length;
        if (remainingBytesNeeded === 0) {
            return [currentIV, chunk];
        }
        if (remainingBytesNeeded >= chunk.length) {
            return [Buffer.concat([currentIV, chunk]), Buffer.alloc(0)];
        }
        const fullIV = Buffer.concat([currentIV, chunk.slice(0, remainingBytesNeeded)]);
        return [fullIV, chunk.slice(remainingBytesNeeded)];
    }
    getTransform() {
        const streamClass = this;
        return function transform(chunk, _, callback) {
            if (!chunk.length) {
                return callback();
            }
            if (!streamClass.hasStrippedOffVersionHeader) {
                chunk = chunk.slice(Constants_1.VERSION_HEADER_LENGTH);
                streamClass.hasStrippedOffVersionHeader = true;
            }
            if (!streamClass.decipher) {
                const [currentIV, updatedChunk] = streamClass.pullIVFromFrontOfBytes(streamClass.iv, chunk);
                streamClass.iv = currentIV;
                if (currentIV.length !== Constants_1.AES_IV_LENGTH) {
                    return callback();
                }
                chunk = updatedChunk;
                streamClass.decipher = crypto.createDecipheriv(Constants_1.AES_ALGORITHM, streamClass.aesKey, streamClass.iv);
            }
            const [newTrailingChunk, encryptChunk] = streamClass.stripAuthTagAndLastAESBlock(streamClass.authTagAndLastBlock, chunk);
            streamClass.authTagAndLastBlock = newTrailingChunk;
            if (encryptChunk.length) {
                this.push(streamClass.decipher.update(encryptChunk));
            }
            callback();
        };
    }
    getFlush() {
        const streamClass = this;
        return function flush(callback) {
            if (!streamClass.decipher) {
                return callback(new Error("Data could not be read from input stream."));
            }
            if (streamClass.authTagAndLastBlock.length !== Constants_1.AES_BLOCK_SIZE + Constants_1.AES_GCM_TAG_LENGTH) {
                return callback(new Error("Length of data from provided input stream was not of the minimum length."));
            }
            const lastBlock = streamClass.authTagAndLastBlock.slice(0, Constants_1.AES_BLOCK_SIZE);
            const authTag = streamClass.authTagAndLastBlock.slice(Constants_1.AES_BLOCK_SIZE);
            streamClass.decipher.setAuthTag(authTag);
            this.push(Buffer.concat([streamClass.decipher.update(lastBlock), streamClass.decipher.final()]));
            callback();
        };
    }
    getDecryptionStream() {
        return new stream_1.Transform({
            transform: this.getTransform(),
            flush: this.getFlush(),
        });
    }
}
exports.StreamingDecryption = StreamingDecryption;
