/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: "server",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: ["<rootDir>/server/**/*.test.(ts|tsx|js|jsx)"],
      moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
      globals: {
        "ts-jest": {
          tsconfig: {
            jsx: "react-jsx",
          },
        },
      },
      moduleNameMapper: {
        "^@shared/(.*)$": "<rootDir>/shared/$1",
      },
    },
    {
      displayName: "client",
      preset: "ts-jest",
      testEnvironment: "<rootDir>/client/src/test/happy-dom-environment.ts",
      testMatch: ["<rootDir>/client/src/**/*.test.(ts|tsx|js|jsx)"],
      moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
      setupFilesAfterEnv: ["<rootDir>/client/src/test/setup-tests.ts"],
      globals: {
        "ts-jest": {
          tsconfig: {
            jsx: "react-jsx",
          },
        },
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/client/src/$1",
        "^@shared/(.*)$": "<rootDir>/shared/$1",
        "^canvas$": "<rootDir>/client/src/test/mocks/canvas.ts",
      },
    },
  ],
};
