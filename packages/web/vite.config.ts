import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@rayhealth/core': path.resolve(__dirname, '../core/src'),
    },
  },
});
