## 0.6.0

### Breaking Changes

* Added restrictions for user, group, and document IDs. If any method is called with an ID that doesn't conform to the ID requirements, that method will throw. IDs are now restricted to the following characters:
  + Any number (0-9)
  + Any uppercase or lowercase letter from a-z
  + The following special characters `_.$#|@/:;=+'-`
  + Be at most 100 characters long

### Added

* Added new [`SDK.group.update()`](https://docs.ironcorelabs.com/ironnode-sdk/group#update-group) method to update a group. Currently only supports updating the name to a new value or clearing the name.
* Added new [`SDK.group.delete()`](https://docs.ironcorelabs.com/ironnode-sdk/group#group-delete) method to delete a group. Group deletes are permanent and will cause all documents that are only encrypted to the group to no longer be decryptable. Use caution when calling this method.
* Added new [`SDK.User.listDevices()`](https://docs.ironcorelabs.com/ironnode-sdk/user#list-devices) method which will list all of the devices the user has currently authorized to decrypt their data.
* Added new [`SDK.User.deleteDevice()`](https://docs.ironcorelabs.com/ironnode-sdk/user#delete-device) method which will deauthorize a users device keys given their ID and cause those keys to no longer be able to decrypt a users data.
* Added argument to [`IronNode.User.generateDeviceKeys()`](https://docs.ironcorelabs.com/ironnode-sdk/user-operations#gen-device-keys) method to be able to specify a readable name for a device upon creation.
* A new error code (`IronNode.ErrorCodes.REQUEST_RATE_LIMITED`) will be returned if usage of the SDK is high enough to cause the IP to be rate limited. When this error code is returned, no further API requests will be returned until usage has dropped for 1 minute.

## 0.5.4

### Breaking Changes

None

### Added

* Added [`SDK.document.getDocumentIDFromBytes()`](https://docs.ironcorelabs.com/ironnode-sdk/document#get-id-from-bytes) and [`SDK.document.getDocumentIDFromStream()`](https://docs.ironcorelabs.com/ironnode-sdk/document#get-id-from-stream) methods to allow document IDs to be extracted from their encrypted content. Starting with this version all newly encrypted documents will have their ID embedded into a header of the encrypted document. These two methods will only return a value when passed documents created from this version on. Older versions will just return `null`.

## 0.5.3

### Breaking Changes

None

### Changed

* Fixed exported TS types for `User` top level object.


## 0.5.2

### Breaking Changes

None

### Changed

* Consumed updated changes from [`recrypt-node-binding`](https://github.com/IronCoreLabs/recrypt-node-binding) for method name change.
* Added supported Node versions, platforms, and architectures to package.json.


## 0.5.1

Initial open source release
