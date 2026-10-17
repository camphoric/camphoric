import js from '@eslint/js';
import jest from 'eslint-plugin-jest';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// An event package imports only its own files, the spec and import-tools, so
// its folder works as a repository of its own: no relative import may climb
// out of the package (from a file `depth` folders down), and no other
// @camphoric/camphoric-event-* package (such as another event) may be imported.
const MESSAGE = 'An event package imports only its own files, @camphoric/camphoric-event-import-spec and @camphoric/camphoric-event-import-tools.';
const isolation = (depth) => ({
  files: [[...Array(depth).fill('*'), '*.ts'].join('/')],
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
  { ignores: ['node_modules/', 'dist/'] },
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
  ...[0, 1, 2, 3, 4].map(isolation),
  {
    files: ['__tests__/**'],
    ...jest.configs['flat/recommended'],
  },
);
