import type { Config } from '@jest/types';

// Sync object
const config: Config.InitialOptions = {
  verbose: true,
  preset: 'ts-jest',
  // preset: 'ts-jest/presets/js-with-ts-esm',
  // testEnvironment: 'node',
  // transform: {
  //   '^.+\\.m?[tj]sx?$': ['ts-jest', {
  //     tsconfig: {
  //       allowJs: true,
  //     },
  //   }],
  // },
};

export default config;
