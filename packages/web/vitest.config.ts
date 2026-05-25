import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['dist/**', 'e2e/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'],
    environment: 'jsdom',
    globals: true,
  },
});
