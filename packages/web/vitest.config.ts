import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // vitest.config.ts fully REPLACES vite.config.ts, it does not merge with it,
  // so the @rayhealth/core alias has to be repeated here or every test that
  // touches the theme resolver fails to resolve it.
  resolve: {
    alias: {
      '@rayhealth/core': path.resolve(__dirname, '../core/src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // vitest 4 no longer excludes dist/ by default; keep discovery in src.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
