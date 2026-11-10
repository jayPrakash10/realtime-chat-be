module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/db.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // The first run downloads a MongoDB binary for mongodb-memory-server, which can take a while.
  testTimeout: 60000,
};
