Release Checklist
=================

* Decide on the new version number and update it within the `package.json` file. This will be used as the NPM version number.
* Add the CHANGELOG.md entry for the release by looking at the PRs.
* Commit `package.json` (for version number) and `CHANGELOG.md`.
* Run the `./build.js` script to make sure the build runs successfully.
* If it all looks good, run `./build.js --publish` which will compile the SDK, push it to NPM, and push a tag to the repo.