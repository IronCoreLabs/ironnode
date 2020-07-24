/**
 * We want to partially mock out the Node crypto module so we can avoid making actual calls to the crypto.randomBytes method
 * which makes testing fairly difficult. This tweaks the core crypto module by adding a few utility methods as well as overwriting
 * the randomBytes method while leaving all other methods on the module intact.
 */

const crypto = jest.requireActual("crypto");

let mockRandomBuffer = Buffer.alloc(0);
let mockImplementation;
let shouldThrow = false;
let realRandom = crypto.randomBytes;

//Allow tests to set the random data they want to return on `crypto.randomBytes` calls
crypto.__setRandomData = (data) => {
    mockImplementation = undefined;
    mockRandomBuffer = data;
};
crypto.__clearRandomData = () => (mockRandomBuffer = Buffer.alloc(0));
//Allow tests to set a mock implementation for the `crypto.randomBytes` calls.
crypto.__setMockImplementation = (mock) => {
    mockImplementation = mock;
};
crypto.__clearMockImplementation = () => (mockImplementation = undefined);

//Allow tests to cause the `crypto.randomBytes` method to throw exceptions
crypto.__shouldThrow = (should) => {
    mockImplementation = undefined;
    shouldThrow = should;
};

//Mocked version of the `crypto.randomBytes` method. Supports both sync and async versions of this method. Returns
//the most recent mocked data set above, optionally throwing an exception if flag is toggled.
crypto.randomBytes = (size, callback) => {
    if (mockImplementation) {
        return mockImplementation(size, callback);
    }
    if (shouldThrow) {
        throw new Exception();
    }
    if (!mockRandomBuffer.length) {
        return realRandom(size, callback);
    }
    if (callback) {
        return callback(null, mockRandomBuffer);
    }
    return mockRandomBuffer;
};

module.exports = crypto;
