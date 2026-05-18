import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'tsconfig.tsbuildinfo']
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  }
];
