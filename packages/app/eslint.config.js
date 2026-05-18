import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'tsconfig.tsbuildinfo']
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node
    }
  }
];
