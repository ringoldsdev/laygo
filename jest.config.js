export default {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/**/__tests__/**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/"],
  reporters: ["default"],
  // globals: { "ts-jest": { diagnostics: false } },
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest"
  },
  transformIgnorePatterns: ["node_modules/@src/*"]
};
