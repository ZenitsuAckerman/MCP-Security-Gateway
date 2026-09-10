/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json'
      }
    ]
  },
  testMatch: [
    "**/src/**/*.test.[jt]s?(x)",
    "**/tests/**/*.test.[jt]s?(x)",
    "**/public/**/*.test.[jt]s?(x)"
  ]
};
