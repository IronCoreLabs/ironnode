## 0.8.1

### Breaking Changes

None

### Changed

Updated all dependencies to their latest version.

## 0.8.0

### Breaking Changes

+ Removed Node 8 support

### Changed

-   Added Windows support.
-   Added `grantToAuthor` option to `DocumentCreateOptions`. This allows creating a document without encrypting it to the currently initialized user. Defaults to true. If false, caller must provide a value within either the user or group access lists, as every document must be encrypted to at least one user or group.
-   Key Rotation
    -   User Key Rotation: Added the ability to rotate a users private key while keeping their public key the same. This is accomplished via multi-party computation with the IronCore webservice. The main use case for this is a workflow that requires that the users account be generated prior to the user logging in for the first time.
        -   Users can be created with a flag marking their account as needing rotation when using the `IronNode.User.create()` call.
        -   User private keys can be rotated using the new `SDK.user.rotateMasterKey(password: string)` method.
    -   Group Key Rotation. Added the ability to rotate a groups private key while keeping the group public key the same. This works the same way as user key rotation and supports the use case where the group is generated prior to the admins logging in for the first time.
        -   Groups can be created with a flag marking their need for rotation a `needsRotation` flag to the `GroupCreateOptions`
        -   Group private key scan be rotated using the new `SDK.group.rotatePrivateKey(groupId: string)` method. The calling user must be an administrator of the group in order to rotate its private key.
    -   Initialization return type: After initializing the IronNode SDK, the resulting SDK object will now also contain a `userContext` field which contains key rotation information for the currently initialized user.
        -   `needsRotation`: If `true`, denotes that the current users private key should be rotated.
        -   `groupsNeedingRotation`: Contains a list of group IDs that the current user is an administrator of that are marked as needing their private key rotated.
- Added a method to allow the currently initialized user to change their private key escrow password. The `SDK.user.changePassword(currentPassword: string, newPassword: string)` method decrypts and re-encrypts the users master private key using the provided current and new passwords.

## 0.7.3

### Breaking Changes

None

### Changed

Updated to latest version of `recrypt-node-binding`.

## 0.7.2

### Breaking Changes

None

### Added

-   Updated `recrypt-node-binding` to support musl distributions.

## 0.7.1

-   Update `recrypt-node-binding` dependency and various dev dependencies.

## 0.7.0

-   Upgraded `recrypt-node-binding` dependency as well as all other dependencies. This adds support for Node 12 and removes support for Node 9 and Node 11.

## 0.6.1

### Added

-   All document and group methods which return the details about the document/group will now include a `created` and `updated` timestamp fields. These timestamps are strings formatted in RFC3339 format which can be passed directly into the `Date` constructor (e.g. `new Date(document.created)`).

## 0.6.0

### Breaking Changes

-   Added restrictions for user, group, and document IDs. If any method is called with an ID that doesn't conform to the ID requirements, that method will throw. IDs are now restricted to the following characters:
    -   Any number (0-9)
    -   Any uppercase or lowercase letter from a-z
    -   The following special characters `_.$#|@/:;=+'-`
    -   Be at most 100 characters long

### Added

-   Added new [`SDK.group.update()`](https://docs.ironcorelabs.com/ironnode-sdk/group#update-group) method to update a group. Currently only supports updating the name to a new value or clearing the name.
-   Added new [`SDK.group.delete()`](https://docs.ironcorelabs.com/ironnode-sdk/group#group-delete) method to delete a group. Group deletes are permanent and will cause all documents that are only encrypted to the group to no longer be decryptable. Use caution when calling this method.
-   Added new [`SDK.user.listDevices()`](https://docs.ironcorelabs.com/ironnode-sdk/user#list-devices) method which will list all of the devices the user has currently authorized to decrypt their data.
-   Added new [`SDK.user.deleteDevice()`](https://docs.ironcorelabs.com/ironnode-sdk/user#delete-device) method which will deauthorize a users device keys given their ID and cause those keys to no longer be able to decrypt a users data.
-   Added argument to [`IronNode.User.generateDeviceKeys()`](https://docs.ironcorelabs.com/ironnode-sdk/user-operations#gen-device-keys) method to be able to specify a readable name for a device upon creation.
-   A new error code (`IronNode.ErrorCodes.REQUEST_RATE_LIMITED`) will be returned if usage of the SDK is high enough to cause the IP to be rate limited. When this error code is returned, no further API requests will be returned until usage has dropped for 1 minute.

## 0.5.4

### Breaking Changes

None

### Added

-   Added [`SDK.document.getDocumentIDFromBytes()`](https://docs.ironcorelabs.com/ironnode-sdk/document#get-id-from-bytes) and [`SDK.document.getDocumentIDFromStream()`](https://docs.ironcorelabs.com/ironnode-sdk/document#get-id-from-stream) methods to allow document IDs to be extracted from their encrypted content. Starting with this version all newly encrypted documents will have their ID embedded into a header of the encrypted document. These two methods will only return a value when passed documents created from this version on. Older versions will just return `null`.

## 0.5.3

### Breaking Changes

None

### Changed

-   Fixed exported TS types for `User` top level object.

## 0.5.2

### Breaking Changes

None

### Changed

-   Consumed updated changes from [`recrypt-node-binding`](https://github.com/IronCoreLabs/recrypt-node-binding) for method name change.
-   Added supported Node versions, platforms, and architectures to package.json.

## 0.5.1

Initial open source release
