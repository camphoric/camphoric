import js from '@eslint/js';
import jest from 'eslint-plugin-jest';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/'] },
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
