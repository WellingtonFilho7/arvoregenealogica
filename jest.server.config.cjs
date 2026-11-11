module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/server/**/*.test.ts"],
  clearMocks: true,
  collectCoverageFrom: ["server/**/*.ts", "!server/**/*.test.ts"],
};
