module.exports = {
    clearMocks: true,
    restoreMocks: true,
    errorOnDeprecated: true,
    coverageThreshold: {
        global: {
            branches: 95,
            functions: 95,
            lines: 95,
            statements: -5,
        },
    },
    //Use ts-jest for all .ts files
    transform: {
        "^.+\\.ts$": "ts-jest",
    },
    testRegex: "(\\.|/)(test)\\.(js|ts)$",
    moduleFileExtensions: ["ts", "js", "json"],
    testEnvironment: "node",
    setupTestFrameworkScriptFile: "./src/tests/jestSetup.ts",
};
