import {TransformKey} from "@ironcorelabs/recrypt-node-binding";
import {DocumentMetaGetResponseType} from "../api/DocumentApi";
import {PublicKey, TransformedEncryptedMessage, RecryptEncryptedMessage} from "../commonTypes";

export const testAccountID = "10";
export const testSegmentID = 30;

export const accountPublicBytes = {
    x: Buffer.from("OSfTv0+o+Rb5OAd8vX9cR/V/h0xZJHA6WSZ+Jrl77iY=", "base64"),
    y: Buffer.from("JERn7u3Z6IdHuSN0wE9Dv/ikqX1xF3s3DJJCbrqWD8I=", "base64"),
};

export const accountPublicBytesBase64 = {
    x: accountPublicBytes.x.toString("base64"),
    y: accountPublicBytes.y.toString("base64"),
};

export const devicePrivateBytes = Buffer.from("T96uYf1l7ba4p6MYfNNNCoD33A0DTqzQ7KYel+j9vcU=", "base64");
export const signingPrivateBytes = Buffer.from("9SwbSnziJ1XRWQfYp2Wobnr3vyLUb3ModKL04/o9A42/xsJsRxOQD5DogBujDAOrZCCIxkVHgP8dzI4OO/N9dg==", "base64");

export function getEncryptedSymmetricKey(): RecryptEncryptedMessage {
    return {
        encryptedMessage:
            "A07omAmqXrgQafLY3OW4H0oZXysTYtTyf+tY67SKu1UUnvBeHceh8Nn5CqTFu4kxTChQ2ep8+OcnSDEMP6VVf47SQ6O2ZkBpVENes+aHtY5s12hHOag9raaZp6AfMmcJBw70jt5pWDBUid253Ky16lt3p7RoMK1um5hPFcYZr412PsMSY92wdNmhdByLgkXVLqFnQTC5mVsr207xkadqI3LU8YP2a990TBJSxsorSY6bIy+HADcoVLQW/XkU5T+0Fb09coQnAhSLnBDP8NdnylNws9pIIYhyHAwEIxifAMltUD/Jq9luxoKA1bZThe0/ZZZGnX3COZEkvtrYIp/xLHG/xRkBr7eSxSkTR8xIZTFywz5kFxLQYhxnTzR5VmsoK5vTKqKBVmHmU1LyOktbUhV+HNYNP8BiUhQypBLGvyNMhwPEvsTRtc50Qa0kMwxhWSPrKnqPWUFzB1jML+p8TlBHECTIsOjCTLpDQMgth2vfsMA2Uv9gHfu982L3zX7F",
        ephemeralPublicKey: {
            x: "H3upGv7w+Ac5qrwNewRyLP+GYtFpQery27P6H/gXaKU=",
            y: "Alm3/nVs6d/mmoBZ28EL3NEKUCB66GsCRBmxRZjjT9U=",
        },
        authHash: "",
        publicSigningKey: "",
        signature: "",
    };
}

export function getTransformedSymmetricKey(): TransformedEncryptedMessage {
    return {
        ...getEncryptedSymmetricKey(),
        transformBlocks: [
            {
                encryptedTempKey: "",
                publicKey: {x: "", y: ""},
                randomTransformEncryptedTempKey: "",
                randomTransformPublicKey: {x: "", y: ""},
            },
        ],
    };
}

export function getEncryptedDocumentMetaResponse(): DocumentMetaGetResponseType {
    return {
        encryptedSymmetricKey: getTransformedSymmetricKey(),
        id: "docID",
        name: "my doc",
        visibleTo: {
            users: [{id: "user-11"}, {id: "user-33"}],
            groups: [{id: "group-34", name: "ICL"}],
        },
        association: {
            type: "owner",
        },
        created: '2018-11-28T00:20:16.617Z',
        updated: '2018-12-04T15:50:01.837Z'
    };
}

export function getEmptyPublicKey(): PublicKey<Buffer> {
    return {
        x: Buffer.from([]),
        y: Buffer.from([]),
    };
}

export function getEmptyPublicKeyString(): PublicKey<string> {
    return {
        x: Buffer.from([]).toString("base64"),
        y: Buffer.from([]).toString("base64"),
    };
}

export function getSigningKeyPair() {
    return {
        privateKey: signingPrivateBytes,
        publicKey: signingPrivateBytes.slice(32),
    };
}

export function getTransformKey(): TransformKey {
    return {
        ephemeralPublicKey: getEmptyPublicKey(),
        toPublicKey: getEmptyPublicKey(),
        encryptedTempKey: Buffer.from([]),
        hashedTempKey: Buffer.from([]),
        publicSigningKey: Buffer.from([]),
        signature: Buffer.from([]),
    };
}
