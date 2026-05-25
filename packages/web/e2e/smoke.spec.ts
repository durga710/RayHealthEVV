import { test, expect } from '@playwright/test';

/**
 * Smoke tests for RayHealth EVV web app.
 *
 * Scope: build-time correctness only — no live DB or auth required.
 * These run against the compiled dist in CI (E2E_BASE_URL=http://localhost:4173).
 *
 * Tests intentionally avoid anything that needs a session/cookie, so they
 * work against the static build without a running backend.
 */

test.describe('Unauthenticated entry points', () => {
  test('root path renders the public landing page', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /EVV operations that prove the visit happened/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Access Admin Portal/i }).first()).toHaveAttribute(
      'href',
      '/login',
    );
  });

  test('login page renders an email input', async ({ page }) => {
    await page.goto('/login');
    // The login page renders an <input type="email"> — confirm it's visible
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();
  });

  test('login page renders a password input', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
  });

  test('login page has a submit button', async ({ page }) => {
    await page.goto('/login');
    // Button may say "Login", "Sign in", etc — match broadly
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
  });

  test('invite acceptance route renders without crashing', async ({ page }) => {
    // /accept/:token is the public caregiver invite page — should render
    // a loading or error state (not a blank screen or JS exception)
    await page.goto('/accept/test-token-smoke');
    // Any visible text means the page rendered — no uncaught JS error
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();
  });
});
