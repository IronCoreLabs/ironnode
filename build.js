#!/usr/bin/env node

/**
 * IronNode SDK Build File
 * ========================
 *
 * This build file is responsible for compiling the IronNode SDK from TypeScript into ES6 JavaScript to work within Node applications. The
 * resulting build will be put into a top-level `dist` directory where it will be ready to perform an NPM publish step.
 *
 * Running this build script will also run unit tests to ensure they pass before deploying any code.
 *
 * In addition, during the build process we'll also replace the API endpoint this SDK hits from the local environment to the production environment. Therefore
 * the published version of this SDK will only work against a production environment.
 */

const path = require("path");
const shell = require("shelljs");
const package = require("./package.json");

//Fail this script if any of these commands fail
shell.set("-e");

const args = process.argv.slice(2);

if (args.indexOf("-h") !== -1 || args.indexOf("--help") !== -1) {
    shell.echo("Build script to compile IronNode SDK");
    shell.echo();
    shell.echo("  Usage: ./build.js");
    shell.exit(0);
}

//Ensure that we're at the root directory of the repo to start
const buildScriptDirectory = path.dirname(process.argv[1]);
shell.cd(path.join(buildScriptDirectory));

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

console.log("\n\nBuild Complete!");
