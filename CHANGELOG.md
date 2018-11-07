## 0.5.4

### Breaking Changes

None

### Added

* Added `SDK.document.getDocumentIDFromBytes()` and `SDK.document.getDocumentIDFromStream()` methods to allow document IDs to be extracted from their encrypted content. Starting with this version all newly encrypted documents will have their ID embedded into a header of the encrypted document. These two methods will only return a value when passed documents created from this version on. Older versions will just return `null`.

### Changed

None

## 0.5.3

### Breaking Changes

None

### Added

None

### Changed

* Fixed exported TS types for `User` top level object.


## 0.5.2

### Breaking Changes

None

### Added

None

### Changed

* Consumed updated changes from [`recrypt-node-binding`](https://github.com/IronCoreLabs/recrypt-node-binding) for method name change.
* Added supported Node versions, platforms, and architectures to package.json.


## 0.5.1

Initial open source release
