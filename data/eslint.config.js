import js from '@eslint/js';
import jest from 'eslint-plugin-jest';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// The isolation rule each event's own eslint.config.js has, applied here too,
// since linting from data/ uses only this config: an event imports only its
// own files (no relative import climbs out of events/<name>, from a file
// `depth` folders down), the spec and import-tools.
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
  { ignores: ['node_modules/', 'packages/*/dist/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      indent: ['error', 2],
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'no-duplicate-imports': 'error',
    },
  },
  ...[0, 1, 2, 3, 4].map(eventIsolation),
  {
    // pasted into a browser console, not run by node
    files: ['snippetToReplaceLodgingTree.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['__tests__/**'],
    ...jest.configs['flat/recommended'],
  },
);
