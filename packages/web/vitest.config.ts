import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@rayhealth/core': path.resolve(__dirname, '../core/src'),
      // Trailing slash so the prefix only matches `@/...`, not scoped
      // packages like `@radix-ui/*` or `@vitejs/plugin-react`.
      '@/': path.resolve(__dirname, './src') + '/',
    },
  },
  test: {
    exclude: ['dist/**', 'e2e/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'],
    environment: 'jsdom',
    globals: true,
    alias: {
      '@rayhealth/core': path.resolve(__dirname, '../core/src'),
      '@/': path.resolve(__dirname, './src') + '/',
    },
  },
});
