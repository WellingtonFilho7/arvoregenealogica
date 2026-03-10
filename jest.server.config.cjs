module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/server/**/*.test.js"],
  clearMocks: true,
  collectCoverageFrom: ["server/**/*.js", "!server/**/*.test.js"],
};
