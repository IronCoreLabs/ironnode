export type Base64String = string;
export type PrivateKey<T> = T;
export interface PublicKey<T> {
    x: T;
    y: T;
}

export interface DocumentAccessList {
    users?: Array<{id: string}>;
    groups?: Array<{id: string}>;
}

export interface DocumentCreateOptions {
    documentID?: string;
    documentName?: string;
    accessList?: DocumentAccessList;
}
export interface GroupCreateOptions {
    groupID?: string;
    groupName?: string;
    addAsMember?: boolean;
}

export type DocumentAssociation = "owner" | "fromUser" | "fromGroup";
export interface DocumentVisibilityList {
    users: Array<{id: string}>;
    groups: Array<{id: string; name?: string}>;
}

/**
 * Document SDK response types
 */
export interface ApiUserResponse {
    accountID: string;
    segmentID: number;
    userMasterPublicKey: PublicKey<Base64String>;
}
export interface DocumentIDNameResponse {
    documentID: string;
    documentName: string | null;
}
export interface DocumentAssociationResponse extends DocumentIDNameResponse {
    association: DocumentAssociation;
}
export interface DocumentListResponse {
    result: DocumentAssociationResponse[];
}
export interface DocumentMetaResponse extends DocumentAssociationResponse {
    visibleTo: DocumentVisibilityList;
}
export interface DecryptedDocumentResponse extends DocumentMetaResponse {
    data: Buffer;
}
export interface EncryptedDocumentResponse extends DocumentIDNameResponse {
    document: Buffer;
}
export interface DocumentAccessResponse {
    succeeded: Array<{
        id: string;
        type: "user" | "group";
    }>;
    failed: Array<{
        id: string;
        type: "user" | "group";
        error: string;
    }>;
}

/**
 * Group SDK response types
 */
export interface GroupMetaResponse {
    groupID: string;
    groupName: string | null;
    isAdmin: boolean;
    isMember: boolean;
}
export interface GroupListResponse {
    result: GroupMetaResponse[];
}
export interface GroupDetailResponse extends GroupMetaResponse {
    groupAdmins: string[];
    groupMembers: string[];
}
export interface GroupUserEditResponse {
    succeeded: string[];
    failed: Array<{
        id: string;
        error: string;
    }>;
}

export interface UserPublicKeyGetResponse {
    [userID: string]: PublicKey<string> | null;
}

export interface Document {
    list(): Promise<DocumentListResponse>;
    getMetadata(documentID: string): Promise<DocumentMetaResponse>;
    decryptBytes(documentID: string, encryptedDocument: Buffer): Promise<DecryptedDocumentResponse>;
    encryptBytes(documentData: Buffer, options?: DocumentCreateOptions): Promise<EncryptedDocumentResponse>;
    encryptStream(inputStream: NodeJS.ReadableStream, outputStream: NodeJS.WritableStream, options?: DocumentCreateOptions): Promise<DocumentIDNameResponse>;
    updateEncryptedBytes(documentID: string, newDocumentData: Buffer): Promise<EncryptedDocumentResponse>;
    updateEncryptedStream(documentID: string, inputStream: NodeJS.ReadableStream, outputStream: NodeJS.WritableStream): Promise<DocumentIDNameResponse>;
    updateName(documentID: string, name: string | null): Promise<DocumentIDNameResponse>;
    grantAccess(documentID: string, grantList: DocumentAccessList): Promise<DocumentAccessResponse>;
    revokeAccess(documentID: string, revokeList: DocumentAccessList): Promise<DocumentAccessResponse>;
}

export interface Group {
    list(): Promise<GroupListResponse>;
    get(groupID: string): Promise<GroupMetaResponse | GroupDetailResponse>;
    create(options?: GroupCreateOptions): Promise<GroupDetailResponse>;
    addAdmins(groupID: string, adminList: string[]): Promise<GroupUserEditResponse>;
    removeAdmins(groupID: string, adminList: string[]): Promise<GroupUserEditResponse>;
    addMembers(groupID: string, userList: string[]): Promise<GroupUserEditResponse>;
    removeMembers(groupID: string, userList: string[]): Promise<GroupUserEditResponse>;
}

export interface User {
    getPublicKey(users: string | string[]): Promise<UserPublicKeyGetResponse>;
}

export interface SDK {
    document: Document;
    group: Group;
    user: User;
}

export class SDKError extends Error {
    constructor(error: Error, code: number);
    code: number;
    rawError: Error;
}

export const ErrorCodes: {[key: string]: number};

export function initialize(accountID: string, segmentID: number, privateDeviceKey: Base64String, privateSigningKey: Base64String): Promise<SDK>;

export interface DeviceDetails {
    accountID: string;
    segmentID: number;
    deviceKeys: {
        publicKey: PublicKey<Base64String>;
        privateKey: Base64String;
    };
    signingKeys: {
        publicKey: Base64String;
        privateKey: Base64String;
    };
}

export namespace User {
    export function verify(jwt: string): Promise<ApiUserResponse | undefined>;
    export function create(jwt: string, password: string): Promise<ApiUserResponse>;
    export function generateDeviceKeys(jwt: string, password: string): Promise<DeviceDetails>;
}
