import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Resolve the workspace package to its TypeScript source so tests run
  // without a prior `tsc` build of @rayhealth/core's dist (which is
  // gitignored and absent in CI). Mirrors packages/web/vitest.config.ts.
  resolve: {
    alias: {
      '@rayhealth/core': path.resolve(__dirname, '../core/src'),
    },
  },
  test: {
    exclude: ['dist/**', 'node_modules/**'],
    environment: 'node',
    globals: true,
    alias: {
      '@rayhealth/core': path.resolve(__dirname, '../core/src'),
    },
  },
});
