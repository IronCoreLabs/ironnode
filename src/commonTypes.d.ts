/*
 * Common types and object shapes
 */
export type Base64String = string;
export type PrivateKey<T> = T;
export type SigningPublicKey<T> = T;

export interface PublicKey<T> {
    x: T;
    y: T;
}
export interface MessageSignature {
    message: string;
    signature: string;
    version: number;
}
export interface SigningKeyPair {
    publicKey: SigningPublicKey<Buffer>;
    privateKey: PrivateKey<Buffer>;
}
export interface KeyPair {
    publicKey: PublicKey<Buffer>;
    privateKey: PrivateKey<Buffer>;
}
export interface KeyPairSet {
    userKeys: KeyPair;
    deviceKeys: KeyPair;
}
export interface RecryptEncryptedMessage {
    encryptedMessage: Base64String;
    ephemeralPublicKey: PublicKey<Base64String>;
    authHash: Base64String;
    publicSigningKey: Base64String;
    signature: Base64String;
}
export interface TransformBlock {
    encryptedTempKey: Base64String;
    publicKey: PublicKey<Base64String>;
    randomTransformEncryptedTempKey: Base64String;
    randomTransformPublicKey: PublicKey<Base64String>;
}
export interface TransformedEncryptedMessage extends RecryptEncryptedMessage {
    transformBlocks: TransformBlock[];
}
export interface EncryptedAccessKey {
    encryptedPlaintext: RecryptEncryptedMessage;
    publicKey: PublicKey<string>;
    id: string;
}
export interface DocumentHeader {
    _did_: string;
    _sid_: number;
}

/*
 * API response types
 */
export interface UserOrGroup {
    type: "user" | "group";
    id: string;
    masterPublicKey: PublicKey<string>;
}
export interface UserOrGroupPublicKey {
    id: string;
    masterPublicKey: PublicKey<Base64String>;
}
export interface GroupApiBasicResponse {
    id: string;
    name: string | null;
    status: number;
    permissions: string[];
    created: string;
    updated: string;
}
export interface GroupApiFullResponse extends GroupApiBasicResponse {
    groupMasterPublicKey: PublicKey<string>;
    encryptedPrivateKey?: TransformedEncryptedMessage;
}
export interface GroupApiFullDetailResponse extends GroupApiFullResponse {
    adminIds: string[];
    memberIds: string[];
}
