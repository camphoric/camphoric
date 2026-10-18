import js from '@eslint/js';
import jest from 'eslint-plugin-jest';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// The isolation rule each event's own eslint.config.js has, for an event
// folder without one (ESLint lints each file with the eslint.config.js nearest
// it, so an event that has its own uses that): an event imports only its own
// files (no relative import climbs out of events/<name>, from a file `depth`
// folders down), the spec and import-tools.
const MESSAGE = 'An event package imports only its own files, @camphoric/camphoric-event-import-spec and @camphoric/camphoric-event-import-tools.';
const eventIsolation = (depth) => ({
  files: [['events', '*', ...Array(depth).fill('*'), '*.ts'].join('/')],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: [`${'../'.repeat(depth + 1)}*`], message: MESSAGE },
        {
          group: [
            '@camphoric/camphoric-event-*',
            '!@camphoric/camphoric-event-import-spec', '!@camphoric/camphoric-event-import-spec/*',
            '!@camphoric/camphoric-event-import-tools', '!@camphoric/camphoric-event-import-tools/*',
          ],
          message: MESSAGE,
        },
      ],
    }],
  },
});

export default tseslint.config(
  { ignores: ['node_modules/', 'packages/*/dist/', 'events/*/dist/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
      // ESLint resolves each file's config from its own folder, so linting
      // from data/ loads this config and each event's; typescript-eslint
      // can't then guess which folder's tsconfig a file belongs to.
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      indent: ['error', 2],
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'always'],
      'no-duplicate-imports': 'error',
    },
  },
  ...[0, 1, 2, 3, 4].map(eventIsolation),
  {
    // pasted into a browser console, not run by node; its lodging list is
    // indented to show the tree
    files: ['snippetToReplaceLodgingTree.js'],
    languageOptions: { globals: globals.browser },
    rules: { indent: 'off' },
  },
  {
    files: ['__tests__/**'],
    ...jest.configs['flat/recommended'],
  },
  {
    files: ['__tests__/**'],
    rules: {
      // the schema-check test, skipped where server/ or python3 is missing
      'jest/no-standalone-expect': ['error', { additionalTestBlockFunctions: ['schemaTest'] }],
    },
  },
);
