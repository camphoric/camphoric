import js from '@eslint/js';
import pluginQuery from '@tanstack/eslint-plugin-query';
import configPrettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['build', 'dist', 'storybook-static', 'node_modules', 'coverage', '.storybook'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      // Type-checked rules — backed by the real TypeScript compiler so judgments
      // match tsc, and no-floating-promises/no-misused-promises catch unawaited
      // queries/mutations (the key failure mode in a data-fetching app). DR-7.
      ...tseslint.configs.recommendedTypeChecked,
      ...pluginQuery.configs['flat/recommended'],
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y-x': jsxA11y,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      // react-hooks 7's recommended config adds the React Compiler rules (refs,
      // set-state-in-effect, static-components, …), which report findings the
      // code doesn't fix yet. Until #921 turns them on, only the two classic
      // rules run.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      ...jsxA11y.configs.recommended.rules,
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  // Vitest test files use globals (describe/it/expect) and node-ish setup.
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.node } },
  },
  // Prettier last — turn off stylistic rules it owns.
  configPrettier,
);
