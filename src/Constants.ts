export const AES_ALGORITHM = "aes-256-gcm";
export const AES_SYMMETRIC_KEY_LENGTH = 32;
export const AES_IV_LENGTH = 12;
export const AES_GCM_TAG_LENGTH = 16;
export const AES_BLOCK_SIZE = 16;
export const VERSION_HEADER_LENGTH = 1;
export const HEADER_META_LENGTH_LENGTH = 2;
export const PBKDF2_SALT_LENGTH = 32;
export const PBKDF2_ITERATIONS = () => 250000; //Set this as a function so that we can mock it during unit tests
/**
 * Number which is prepended onto encrypted documents to denote which classification of encrypted data
 * the document represents. Used to have a place to denote header info, symmetric encryption details, etc
 */
export const DOCUMENT_ENCRYPTION_DETAILS_VERSION_NUMBER = 2;

/**
 * Regex of allowed characters that users can provide as part of user, group, and document IDs.
 */
export const ALLOWED_ID_CHAR_REGEX = /^[a-zA-Z0-9_.$#|@/:;=+'-]{1,100}$/;

export const GroupPermissions = {
    ADMIN: "admin",
    MEMBER: "member",
};

export const UserAndGroupTypes = {
    USER: "user",
    GROUP: "group",
};

export const ErrorCodes = {
    INITIALIZE_INVALID_ACCOUNT_ID: 100,
    USER_VERIFY_API_REQUEST_FAILURE: 200,
    USER_CREATE_REQUEST_FAILURE: 201,
    USER_PASSCODE_INCORRECT: 203,
    USER_KEY_LIST_REQUEST_FAILURE: 204,
    USER_DEVICE_ADD_REQUEST_FAILURE: 205,
    USER_MASTER_KEY_GENERATION_FAILURE: 206,
    USER_DEVICE_KEY_GENERATION_FAILURE: 207,
    USER_DEVICE_LIST_REQUEST_FAILURE: 208,
    USER_DEVICE_DELETE_REQUEST_FAILURE: 209,
    USER_UPDATE_KEY_REQUEST_FAILURE: 210,
    USER_PRIVATE_KEY_ROTATION_FAILURE: 211,
    DOCUMENT_LIST_REQUEST_FAILURE: 300,
    DOCUMENT_GET_REQUEST_FAILURE: 301,
    DOCUMENT_CREATE_REQUEST_FAILURE: 302,
    DOCUMENT_UPDATE_REQUEST_FAILURE: 303,
    DOCUMENT_GRANT_ACCESS_REQUEST_FAILURE: 304,
    DOCUMENT_REVOKE_ACCESS_REQUEST_FAILURE: 305,
    DOCUMENT_DECRYPT_FAILURE: 306,
    DOCUMENT_ENCRYPT_FAILURE: 307,
    DOCUMENT_REENCRYPT_FAILURE: 308,
    DOCUMENT_GRANT_ACCESS_FAILURE: 309,
    DOCUMENT_CREATE_WITH_ACCESS_FAILURE: 311,
    DOCUMENT_HEADER_PARSE_FAILURE: 312,
    GROUP_LIST_REQUEST_FAILURE: 400,
    GROUP_GET_REQUEST_FAILURE: 401,
    GROUP_CREATE_REQUEST_FAILURE: 402,
    GROUP_ADD_MEMBERS_REQUEST_FAILURE: 403,
    GROUP_ADD_MEMBER_NOT_ADMIN_FAILURE: 404,
    GROUP_REMOVE_MEMBERS_REQUEST_FAILURE: 405,
    GROUP_REMOVE_SELF_REQUEST_FAILURE: 406,
    GROUP_KEY_GENERATION_FAILURE: 407,
    GROUP_MEMBER_KEY_ENCRYPTION_FAILURE: 408,
    GROUP_ADD_ADMINS_NOT_ADMIN_FAILURE: 409,
    GROUP_ADD_ADMINS_REQUEST_FAILURE: 410,
    GROUP_KEY_DECRYPTION_FAILURE: 411,
    GROUP_REMOVE_ADMINS_REQUEST_FAILURE: 412,
    GROUP_UPDATE_REQUEST_FAILURE: 413,
    GROUP_DELETE_REQUEST_FAILURE: 414,
    GROUP_CREATE_WITH_MEMBERS_OR_ADMINS_FAILURE: 415,
    GROUP_PRIVATE_KEY_ROTATION_FAILURE: 416,
    GROUP_UPDATE_KEY_REQUEST_FAILURE: 417,
    GROUP_ROTATE_PRIVATE_KEY_NOT_ADMIN_FAILURE: 418,
    REQUEST_RATE_LIMITED: 500,
};
