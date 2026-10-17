/** @type {import('jest').Config} */
// Native ESM: the event modules use import.meta.url and ESM-only dependencies
// (ora, chalk), which a CommonJS transform cannot load. Jest runs with
// NODE_OPTIONS=--experimental-vm-modules (see the scripts in package.json), and
// @swc/jest only strips the TypeScript, leaving the imports as ESM.
const config = {
  verbose: true,
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['@swc/jest', {
      jsc: { parser: { syntax: 'typescript' }, target: 'es2022' },
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'mjs', 'cjs', 'json'],
};

module.exports = config;
