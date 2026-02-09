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
  ],
};
