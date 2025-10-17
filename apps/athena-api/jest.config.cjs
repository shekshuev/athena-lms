const { readFileSync } = require("fs");

const swcJestConfig = JSON.parse(readFileSync(`${__dirname}/.spec.swcrc`, "utf-8"));
swcJestConfig.swcrc = false;

module.exports = {
  displayName: "@athena-lms/athena-api",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": ["@swc/jest", swcJestConfig],
  },
  moduleFileExtensions: ["ts", "js", "html"],
  coverageDirectory: "test-output/jest/coverage",
};
