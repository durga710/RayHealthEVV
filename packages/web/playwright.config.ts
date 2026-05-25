import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for RayHealth web e2e tests.
 *
 * CI: E2E_BASE_URL is set to the served built dist (npx serve -s dist -p 4173).
 * Local: uses the vite dev server (npm run dev --workspace=@rayhealth/web).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // Local dev: spin up the vite dev server automatically
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
      },
});
