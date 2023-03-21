module.exports = {
  moduleFileExtensions: ["js", "ts", "tsx"],
  verbose: false,
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/src/**/?(*.)spec.{js,ts,tsx}"],
  testPathIgnorePatterns: ["<rootDir>/node_modules", "/dist/"],
  transformIgnorePatterns: ["/node_modules/", "/dist/"],
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
};
