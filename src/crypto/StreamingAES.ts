import * as crypto from "crypto";
import {Transform, TransformCallback} from "stream";
import {AES_ALGORITHM, AES_BLOCK_SIZE, AES_GCM_TAG_LENGTH, AES_IV_LENGTH, VERSION_HEADER_LENGTH} from "../Constants";

//tslint:disable:max-classes-per-file

export class StreamingEncryption {
    cipher: crypto.CipherGCM;
    iv: Buffer;
    hasPushedOnIV: boolean = false;
    documentHeader: Buffer;

    constructor(documentHeader: Buffer, aesKey: Buffer) {
        this.documentHeader = documentHeader;
        this.iv = crypto.randomBytes(AES_IV_LENGTH);
        this.cipher = crypto.createCipheriv(AES_ALGORITHM, aesKey, this.iv);
    }

    /**
     * Returns method for performing stream transform (i.e. encrypting data and writing it to the out stream). Pushes provided
     * data through AES cipher and write data to stream. If this is the first time we're transforming data, we'll also push on
     * the IV so we can recover it during our streaming decryption.
     */
    getTransform() {
        //tslint:disable-next-line:no-this-assignment
        const streamClass = this;
        return function transform(this: Transform, chunk: Buffer, _: string, callback: TransformCallback) {
            //Check if this is our first transform operation. If so, we need to shove the IV at the front of the resulting
            //buffer in unencrypted form so we can pull it out on decryption.
            if (!streamClass.hasPushedOnIV) {
                streamClass.hasPushedOnIV = true;
                //First push on our single byte version header
                this.push(streamClass.documentHeader);
                this.push(streamClass.iv);
            }
            if (chunk.length) {
                this.push(streamClass.cipher.update(chunk));
            }
            callback();
        };
    }

    /**
     * Handle final transform operation. Get the final cipher data and then also push on the GCM auth tag to the end of the encrypted data.
     */
    getFlush() {
        //tslint:disable-next-line:no-this-assignment
        const streamClass = this;
        return function flush(this: Transform, callback: TransformCallback) {
            //This will only happen if the user is somehow streaming in an empty file. A pretty dumb use case I'll grant you, but it's easy enough to support
            if (!streamClass.hasPushedOnIV) {
                this.push(streamClass.documentHeader);
                this.push(streamClass.iv);
            }
            this.push(Buffer.concat([streamClass.cipher.final(), streamClass.cipher.getAuthTag()]));
            callback();
        };
    }

    /**
     * Return streaming Transform object to pipe through data to encrypt
     */
    getEncryptionStream() {
        return new Transform({
            transform: this.getTransform(),
            flush: this.getFlush(),
        });
    }
}

export class StreamingDecryption {
    decipher: crypto.DecipherGCM | undefined;
    aesKey: Buffer;
    iv = Buffer.alloc(0);
    hasStrippedOffVersionHeader = false;
    authTagAndLastBlock = Buffer.alloc(0);

    constructor(aesKey: Buffer) {
        this.aesKey = aesKey;
    }

    /**
     * We store the AES GCM tag at the very end of our encrypted files. However, when running a streaming encryption operation we don't know
     * how long the data is and therefore we need to do some manual work to make sure we stop decrypting before we reach the auth tag. Since we
     * don't know when we're at the end of the stream, we instead have to manually check for the GCM tag after each chunk of data we get. So when
     * we get data in the transform, we always pull off the last few bytes and store it off in case it's the end of the bytes. If we get more bytes,
     * then we prepend that data we stripped off previously in the front, and remove the same byte length from the back end. This continues until
     * we get to the end and have our last bytes.
     */
    stripAuthTagAndLastAESBlock(currentLastBytes: Buffer, decryptionChunk: Buffer) {
        const totalTrailingChunkSize = AES_BLOCK_SIZE + AES_GCM_TAG_LENGTH;

        const currentFullChunk = Buffer.concat([currentLastBytes, decryptionChunk]);

        if (currentFullChunk.length > totalTrailingChunkSize) {
            return [currentFullChunk.slice(-totalTrailingChunkSize), currentFullChunk.slice(0, -totalTrailingChunkSize)];
        }
        return [currentFullChunk, Buffer.alloc(0)];
    }

    /**
     * Pull the IV from the front of the provided chunk. Handles the case where we don't get enough bytes in the first chunk to be the
     * full IV. This will eventually build up the full IV size if necessary over repeated calls.
     */
    pullIVFromFrontOfBytes(currentIV: Buffer, chunk: Buffer) {
        const remainingBytesNeeded = AES_IV_LENGTH - currentIV.length;
        if (remainingBytesNeeded === 0) {
            return [currentIV, chunk];
        }
        if (remainingBytesNeeded >= chunk.length) {
            return [Buffer.concat([currentIV, chunk]), Buffer.alloc(0)];
        }
        const fullIV = Buffer.concat([currentIV, chunk.slice(0, remainingBytesNeeded)]);
        return [fullIV, chunk.slice(remainingBytesNeeded)];
    }

    /**
     * Read in encrypted content from the stream and update the decipher with the encrypted content. On the first pass through the transform we pull off
     * the IV which is required before we can create our decipher. Then we also do various amounts of bit slicing to keep track of the GCM auth tag at the
     * end.
     */
    getTransform() {
        //tslint:disable-next-line:no-this-assignment
        const streamClass = this;
        return function transform(this: Transform, chunk: Buffer, _: string, callback: TransformCallback) {
            //Don't do anything if we don't get any data for some odd reason
            if (!chunk.length) {
                return callback();
            }
            //TODO: THIS DOESN'T WORK WITH VERSION 2 DATA YET
            if (!streamClass.hasStrippedOffVersionHeader) {
                chunk = chunk.slice(VERSION_HEADER_LENGTH);
                streamClass.hasStrippedOffVersionHeader = true;
            }
            //Check if this is our first pass through the transform. If so, we need to strip out the IV from the first bytes of the
            //content and create our decipher
            if (!streamClass.decipher) {
                const [currentIV, updatedChunk] = streamClass.pullIVFromFrontOfBytes(streamClass.iv, chunk);
                streamClass.iv = currentIV;
                //Check if we have enough bytes from this chunk to be our IV size. If not, store off what we have for the IV so far
                //and get the next chunk of bytes
                if (currentIV.length !== AES_IV_LENGTH) {
                    return callback();
                }
                //Now that we've pulled off the full IV, create our decipher with it
                chunk = updatedChunk;
                streamClass.decipher = crypto.createDecipheriv(AES_ALGORITHM, streamClass.aesKey, streamClass.iv);
            }
            const [newTrailingChunk, encryptChunk] = streamClass.stripAuthTagAndLastAESBlock(streamClass.authTagAndLastBlock, chunk);
            streamClass.authTagAndLastBlock = newTrailingChunk;
            if (encryptChunk.length) {
                this.push(streamClass.decipher.update(encryptChunk));
            }
            callback();
        };
    }

    /**
     * Finish decryption. We take the last AES block and the GCM tag that we've been storing off, verify a few things, and set those appropriately before
     * we call decipher.final to complete the decryption.
     */
    getFlush() {
        //tslint:disable-next-line:no-this-assignment
        const streamClass = this;
        return function flush(this: Transform, callback: TransformCallback) {
            //If we get a flush call before we got a transform call where we setup the decipher, that likely means the file was empty
            if (!streamClass.decipher) {
                return callback(new Error("Data could not be read from input stream."));
            }
            //Validate that we got 32 bytes of data from the stream. Otherwise that means we got an IV but not enough for a single block and the GCM tag
            if (streamClass.authTagAndLastBlock.length !== AES_BLOCK_SIZE + AES_GCM_TAG_LENGTH) {
                return callback(new Error("Length of data from provided input stream was not of the minimum length."));
            }
            //When doing streaming AES in node, we have to set the auth tag before we push on the final amount of AES data. Otherwise
            //when we try to call final() it will fail saying the tag was invalid. So we store off enough data to do one final decipher.update
            //call which happens after we've gotten the GCM auth tag.
            const lastBlock = streamClass.authTagAndLastBlock.slice(0, AES_BLOCK_SIZE);
            const authTag = streamClass.authTagAndLastBlock.slice(AES_BLOCK_SIZE);
            streamClass.decipher.setAuthTag(authTag);
            this.push(Buffer.concat([streamClass.decipher.update(lastBlock), streamClass.decipher.final()]));
            callback();
        };
    }

    /**
     * Return streaming Transform object to pipe through data to decrypt
     */
    getDecryptionStream() {
        return new Transform({
            transform: this.getTransform(),
            flush: this.getFlush(),
        });
    }
}
