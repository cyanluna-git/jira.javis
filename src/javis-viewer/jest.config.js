const path = require('path');

const RUNNER = path.resolve(__dirname, 'node_modules/jest-circus/build/runner.js');
const TRANSFORM = { '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', { configFile: path.resolve(__dirname, 'babel.test.config.js') }] };
const MODULE_MAPPER = { '^@/(.*)$': path.resolve(__dirname, 'src/$1') };

/** @type {import('jest').Config} */
const config = {
  projects: [
    {
      displayName: 'node',
      testEnvironment: 'node',
      testRunner: RUNNER,
      testMatch: ['<rootDir>/src/__tests__/unit/*.test.ts', '<rootDir>/src/__tests__/integration/**/*.test.ts'],
      transform: TRANSFORM,
      moduleNameMapper: MODULE_MAPPER,
    },
    {
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testRunner: RUNNER,
      testMatch: ['<rootDir>/src/__tests__/unit/*.test.tsx'],
      transform: TRANSFORM,
      moduleNameMapper: MODULE_MAPPER,
      setupFilesAfterEnv: [path.resolve(__dirname, 'src/__tests__/setup.ts')],
    },
  ],
};

module.exports = config;
