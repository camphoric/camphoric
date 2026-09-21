/** @type {import('jest').Config} */
// Native ESM: the event modules use import.meta.url and ESM-only dependencies
// (ora, chalk), which babel-jest's CommonJS transform cannot load. Jest runs with
// NODE_OPTIONS=--experimental-vm-modules (see the scripts in package.json).
const config = {
  verbose: true,
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'json'],
};

module.exports = config;
