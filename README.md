# IronCore Labs NodeJS SDK

[![Build Status](https://travis-ci.org/IronCoreLabs/ironnode.svg?branch=master)](https://travis-ci.org/IronCoreLabs/ironnode)
[![NPM Version](https://badge.fury.io/js/%40ironcorelabs%2Fironnode.svg)](https://www.npmjs.com/package/@ironcorelabs/ironnode)

SDK for using IronCore Labs from your NodeJS server side applications. Read [our documentation](https://docs.ironcorelabs.com) for further information about how to integrate this library into your server side application. Also check out the [`integration` directory](integration) for an example of consuming this library.

## Supported Platforms

|           | Node 8 | Node 9  | Node 10 | Node 11 |
| --------- | ------ | ------- | ------- | ------- |
| Linux x64 |    ✓   |    ✓    |    ✓    |    ✓    |
| OSX x64   |    ✓   |    ✓    |    ✓    |    ✓    |

## Installation

`npm install @ironcorelabs/ironnode`

This SDK relies on our [recrypt-node-binding](https://github.com/IronCoreLabs/recrypt-node-binding) Node addon library. This library is distributed as a binary which is specific to both an architecture (OSX/Linux) and Node version (8/10). When you NPM install this SDK it will automatically determine the proper binary to pull down into your `node_modules` directory based on your architecture and Node version.

This means that you'll need to make sure that the machine that runs `npm install` to install this library is the architecture/Node version where the code will run. This library will not work if you run `npm install` on an OSX machine and move the node_modules directory over to a Linux machine, for example.

If the machine you run `npm install` on is not one of the supported architectures you will get an install failure. If there's an architecture or Node version that you'd like supported that isn't yet available, [open a new issue](https://github.com/IronCoreLabs/ironnode/issues/new) and we'll look into adding support for it.

## Types

This library contains a [TypeScript definitions](ironnode.d.ts) file which shows the available classes and methods for this SDK.

## Local Development

### Integration Testing

In order to run the integration tests for this repo you need to have an IronCore Project, Segment, and Service Key to use. If you haven't yet, [sign up for an account](https://admin.ironcorelabs.com/login) and create a set of those to use for testing this library.

Once you have all three items configured, do the following:

+ Copy your Service Key `private.key` file into the `integration` directory.
+ Create a `project.json` file in the `integration` directory with the following JSON form

```
{
    "projectId": numeric project ID,
    "segmentId": string segment ID,
    "serviceKeyId": numeric service key ID,
}
```

Once you have your Service Key private key and config file setup, you can run the `yarn start` command to kick off an interactive CLI tool. This tool will first let you pick a user operation, either verify, create, or generate device keys. You can verify existing users or create new users from this menu. Before any SDK operations are allowed to run you must generate local device keys. When you pick this option and the keys are generated, they will be stored in a `.device.json` file in the `integration` directory. Subsequent CLI runs will ask if you want to use those local device keys.

### Unit Testing and Linting

This repo uses NPM scripts in order to run all tests and linting. You can run both the unit tests and linting together by running `yarn test`.

#### Linting

[TSLint](https://palantir.github.io/tslint/) is used to run linting on all source code. In addition this repo has a [Prettier](https://prettier.io) configuration to auto-format source code upon save. Prettier should be configured within your IDE before contributing to this project.

`yarn run lint`

### Unit Testing

This repo uses [Jest](http://jestjs.io/en) for all unit testing.

`yarn run unit`

To run a subset of the tests you can use the `-t` option of Jest to only run tests whose name matches the provided value

`yarn run unit -t group`
