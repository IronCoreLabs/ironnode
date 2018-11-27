import {TransformKey} from "@ironcorelabs/recrypt-node-binding";
import {PublicKey, Base64String, DocumentHeader} from "../commonTypes";
import {
    AES_IV_LENGTH,
    AES_GCM_TAG_LENGTH,
    DOCUMENT_ENCRYPTION_DETAILS_VERSION_NUMBER,
    HEADER_META_LENGTH_LENGTH,
    VERSION_HEADER_LENGTH,
    ALLOWED_ID_CHAR_REGEX,
} from "../Constants";
import {DocumentAccessList} from "../../ironnode";

export const Codec = {
    /**
     * Various methods to convert Buffers to and from base64 strings and Uint8Arrays
     */
    Buffer: {
        toBase64(bytes: Buffer): Base64String {
            return bytes.toString("base64");
        },
        fromBase64(bytes: Base64String) {
            return Buffer.from(bytes, "base64");
        },
        fromTypedArray(bytes: Uint8Array) {
            return Buffer.from(bytes.buffer);
        },
    },
    /**
     * Various methods to convert PublicKeys from and to base64 strings.
     */
    PublicKey: {
        fromBase64(key: PublicKey<Base64String>): PublicKey<Buffer> {
            return {
                x: Codec.Buffer.fromBase64(key.x),
                y: Codec.Buffer.fromBase64(key.y),
            };
        },
        toBase64(key: PublicKey<Buffer>): PublicKey<Base64String> {
            return {
                x: Codec.Buffer.toBase64(key.x),
                y: Codec.Buffer.toBase64(key.y),
            };
        },
    },
};

/**
 * Convert TransformKeys in byte array form to base64 form.
 */
export function transformKeyToBase64(transformKey: TransformKey) {
    return {
        ephemeralPublicKey: Codec.PublicKey.toBase64(transformKey.ephemeralPublicKey),
        toPublicKey: Codec.PublicKey.toBase64(transformKey.toPublicKey),
        encryptedTempKey: Codec.Buffer.toBase64(transformKey.encryptedTempKey),
        hashedTempKey: Codec.Buffer.toBase64(transformKey.hashedTempKey),
        publicSigningKey: Codec.Buffer.toBase64(transformKey.publicSigningKey),
        signature: Codec.Buffer.toBase64(transformKey.signature),
    };
}

/**
 * Dedupe string values in an array. Expects array of strings which are case-insensitive. Also allows an option
 * to clear all falsy values from the array.
 */
export function dedupeArray(list: string[], clearEmptyValues: boolean = false) {
    const seenList: {[key: string]: boolean} = {};

    return list.filter((item) => {
        if (seenList[item] || (clearEmptyValues && !item.length)) {
            return false;
        }
        seenList[item] = true;
        return true;
    });
}

/**
 * Validate that the provided document ID is a string and has a length
 */
export function validateID(id: string) {
    if (typeof id !== "string" || !id.length) {
        throw new Error(`Invalid ID provided. Expected a non-zero length string but got ${id}`);
    }
    if (!ALLOWED_ID_CHAR_REGEX.test(id)) {
        throw new Error(`Invalid ID provided. Provided value includes invalid characters: '${id}'.`);
    }
}

/**
 * Validate that the provided raw document data is a proper byte array
 */
export function validateDocumentData(data: Buffer) {
    if (!(data instanceof Buffer) || !data.length) {
        throw new Error(`Invalid document data format provided. Expected a Buffer.`);
    }
}

/**
 * Validate that the provided encrypted document is in the proper form, which should be Base64 encoded bytes of the document content and the AES IV prepended. Therefore
 * validate the length is at least 1 more than the IV length.
 */
export function validateEncryptedDocument(documentData: Buffer) {
    if (!(documentData instanceof Buffer)) {
        throw new Error(`Invalid encrypted document format provided. Expected a Buffer.`);
    }
    //The content length of the document should be at least 1 larger than the size of the AES IV + GCM tag
    if (documentData.length < VERSION_HEADER_LENGTH + AES_IV_LENGTH + AES_GCM_TAG_LENGTH) {
        throw new Error(`Invalid encrypted document content. Length of content does not meet minimum requirements.`);
    }
}

/**
 * Validate that the provided list of access IDs is valid
 */
export function validateAccessList(accessList: DocumentAccessList) {
    const isUserListSet = accessList && Array.isArray(accessList.users) && accessList.users.length;
    const isGroupListSet = accessList && Array.isArray(accessList.groups) && accessList.groups.length;

    if (!isUserListSet && !isGroupListSet) {
        throw new Error("You must provide a list of users or groups with which to change document access.");
    }
}

/**
 * Validate a list of IDs. Only used for validating group member edit at this point
 */
export function validateIDList(userList: string[]) {
    if (!Array.isArray(userList) || !userList.length) {
        throw new Error("You must provide a list of users to perform this operation.");
    }
}

/**
 * Take a document access/revoke list and normalize/dedupe the arrays providing back validated defaults for both
 */
export function dedupeAccessLists(accessList: DocumentAccessList) {
    let userAccess: string[] = [];
    let groupAccess: string[] = [];
    if (accessList.users && accessList.users.length) {
        userAccess = dedupeArray(accessList.users.map(({id}) => id), true);
    }
    if (accessList.groups && accessList.groups.length) {
        groupAccess = dedupeArray(accessList.groups.map(({id}) => id), true);
    }
    return [userAccess, groupAccess];
}

/**
 * Return a single byte Buffer which represents the document encryption version details. This byte will
 * be prepended to the front of all encrypted documents.
 */
export function generateDocumentHeaderBytes(documentID: string, segmentID: number) {
    const header = JSON.stringify({
        _did_: documentID,
        _sid_: segmentID,
    } as DocumentHeader);
    const headerDataView = new DataView(new ArrayBuffer(HEADER_META_LENGTH_LENGTH));
    headerDataView.setUint16(0, header.length, false);

    return Buffer.concat([
        //First byte is the version of the document
        Buffer.from([DOCUMENT_ENCRYPTION_DETAILS_VERSION_NUMBER]),
        //Next two bytes are the length of the remaining JSON encoded header
        Buffer.from(headerDataView.buffer),
        //Last N bytes are JSON encoded as utf8 bytes
        Buffer.from(header),
    ]);
}
