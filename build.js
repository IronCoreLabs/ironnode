#!/usr/bin/env node

/**
 * IronNode SDK Build File
 * ========================
 *
 * This build file is responsible for compiling the IronNode SDK from TypeScript into ES6 JavaScript to work within Node applications. The
 * resulting build will be put into a top-level `dist` directory where it will be ready to perform an NPM publish step. If the `--publish` option
 * is provided then the entire dist directory will be pushed up to NPM as @ironcorelabs/ironnode and a tag of the released version will be added
 * to git. Otherwise we'll run a mock publish and leave the dist directory in place.
 *
 * Running this build script will also run unit tests to ensure they pass before deploying any code.
 *
 * In addition, during the build process we'll also replace the API endpoint this SDK hits from the local environment to the production environment. Therefore
 * the published version of this SDK will only work against a production environment.
 */

const fs = require("fs");
const path = require("path");
const shell = require("shelljs");
const package = require("./package.json");

//Fail this script if any of these commands fail
shell.set("-e");

const args = process.argv.slice(2);
const SHOULD_PUBLISH = args.indexOf("--publish") !== -1;

if (args.indexOf("-h") !== -1 || args.indexOf("--help") !== -1) {
    shell.echo("Build script to compile IronNode SDK");
    shell.echo();
    shell.echo("  Usage: ./build.js");
    shell.echo("    Options:");
    shell.echo("      --publish If provided, publish service to NPM and tag repo with version from package.json file.");
    shell.exit(0);
}

/**
 * Publish the SDK. Will do a dry-run unless argument is provided to perform actual publish
 */
function publishModule() {
    shell.pushd("./dist");
    shell.exec(SHOULD_PUBLISH ? "npm publish --access public" : "npm publish --dry-run");
    shell.popd();
}

/**
 * Tag the repo with the current version that we're publishing
 */
function tagRepo(version) {
    if (SHOULD_PUBLISH) {
        shell.exec(`git tag ${version}`);
        shell.exec("git push origin --tags");
    } else {
        console.log(`\n\nWould publish git tag as version ${version}.`);
    }
}

/**
 * Ensure that we're in a pristine, up-to-date repo and on the main branch before allowing user to continue. Only does
 * verification if user is actually trying to perform an NPM publish
 */
function ensureNoChangesOnMainBeforePublish() {
    //Let users try the build script as long as they're not doing an actual publish
    if (!SHOULD_PUBLISH) {
        return true;
    }

    shell.exec("git fetch origin", {silent: true});

    const currentBranch = shell.exec("git symbolic-ref --short -q HEAD", {silent: true});
    if (currentBranch.stdout.trim() !== "main") {
        shell.echo("Modules can only be deployed off 'main' branch.");
        shell.exit(-1);
    }

    const changesOnBranch = shell.exec("git log HEAD..origin/main --oneline", {silent: true});
    if (changesOnBranch.stdout.trim() !== "") {
        shell.echo("Local repo and origin are out of sync! Have you pushed all your changes? Have you pulled the latest?");
        shell.exit(-1);
    }

    const localChanges = shell.exec("git status --porcelain", {silent: true});
    if (localChanges.stdout.trim() !== "") {
        shell.echo("This git repository is has uncommitted files. Publish aborted!");
        shell.exit(-1);
    }
}

//Ensure that we're at the root directory of the repo to start
const buildScriptDirectory = path.dirname(process.argv[1]);
shell.cd(path.join(buildScriptDirectory));

ensureNoChangesOnMainBeforePublish();

//Clean up any existing dist directory
shell.rm("-rf", "./dist");

shell.echo("Running yarn to make sure deps are up to date");
shell.exec("yarn");

shell.echo("\n\nRunning unit tests...");
shell.exec("yarn test --coverage");

shell.echo("\n\nCompiling all source from TypeScript to ES6 JS and removing unit test files");
shell.exec("./node_modules/typescript/bin/tsc --target ES6 --sourceMap false --module CommonJS --outDir ./dist");
shell.exec("find dist -type d -name tests -prune -exec rm -rf {} \\;");

//Copy in various files that we need to deploy as part of our NPM package
shell.cp("./package.json", "./dist");
shell.cp("./ironnode.d.ts", "./dist");
shell.cp("./README.md", "./dist");

publishModule();
tagRepo(package.version);

console.log("\n\nBuild Complete!");
