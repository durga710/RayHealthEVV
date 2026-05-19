/**
 * RayHealth EVV Production E2E Test
 * Tests all major routes and the staff invite flow
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://rayhealth-evv-platform-aocbsz3rb-reyghim1093-5928s-projects.vercel.app';
const ADMIN_EMAIL = 'admin-fixture@rayhealthevv.local';
const ADMIN_PASSWORD = 'TestAdmin2026!';
const INVITE_EMAIL = 'e2etest@rayhealthevv.local';

const ARTIFACTS_DIR = '/Users/durgaghimeray/Desktop/rayhealth-evv-clean/e2e-artifacts';
mkdirSync(ARTIFACTS_DIR, { recursive: true });

const results = [];
const consoleErrors = [];

function log(feature, status, note, extra = '') {
  const line = `[${status}] ${feature}: ${note}${extra ? ' | ' + extra : ''}`;
  console.log(line);
  results.push({ feature, status, note, extra });
}

async function screenshotOnFail(page, name) {
  const path = join(ARTIFACTS_DIR, `${name.replace(/\s+/g, '-').replace(/\//g, '_')}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function checkPageLoaded(page, feature, url, expectedTextOrSelector) {
  try {
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
    const status = response?.status() ?? 0;

    if (status >= 500) {
      const path = await screenshotOnFail(page, feature);
      log(feature, 'FAIL', `HTTP ${status}`, `screenshot: ${path}`);
      return false;
    }

    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    const hasContent = bodyText.trim().length > 50;

    if (!hasContent) {
      const path = await screenshotOnFail(page, feature);
      log(feature, 'FAIL', 'Page appears blank or spinner-only', `screenshot: ${path}`);
      return false;
    }

    const errorKeywords = ['500', 'Internal Server Error', 'Cannot GET', 'Application error'];
    const hasError = errorKeywords.some(kw => bodyText.includes(kw));
    if (hasError) {
      const path = await screenshotOnFail(page, feature);
      log(feature, 'FAIL', 'Error message on page', `screenshot: ${path}`);
      return false;
    }

    if (expectedTextOrSelector) {
      try {
        await page.waitForSelector(expectedTextOrSelector, { timeout: 8000 });
      } catch {
        const hasText = bodyText.toLowerCase().includes(expectedTextOrSelector.toLowerCase());
        if (!hasText) {
          const path = await screenshotOnFail(page, feature);
          log(feature, 'WARN', `Expected content not found: "${expectedTextOrSelector}"`, `screenshot: ${path}`);
          return true;
        }
      }
    }

    log(feature, 'PASS', `Loaded OK (HTTP ${status})`);
    return true;
  } catch (err) {
    const path = await screenshotOnFail(page, feature);
    log(feature, 'FAIL', `Error: ${err.message.split('\n')[0]}`, `screenshot: ${path}`);
    return false;
  }
}

async function runTests() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: ARTIFACTS_DIR, size: { width: 1280, height: 800 } }
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(`[PAGE_ERROR] ${err.message}`);
  });

  try {
    // ── PUBLIC PAGES ──────────────────────────────────────────────
    console.log('\n=== PUBLIC PAGES ===');
    await checkPageLoaded(page, 'Landing (/)', `${BASE_URL}/`, null);
    await checkPageLoaded(page, 'Pricing (/pricing)', `${BASE_URL}/pricing`, null);
    await checkPageLoaded(page, 'Contact (/contact)', `${BASE_URL}/contact`, null);
    await checkPageLoaded(page, 'Demo (/demo)', `${BASE_URL}/demo`, null);
    await checkPageLoaded(page, 'Launch (/launch)', `${BASE_URL}/launch`, null);
    await checkPageLoaded(page, 'Status (/status)', `${BASE_URL}/status`, null);
    await checkPageLoaded(page, 'Privacy (/privacy)', `${BASE_URL}/privacy`, null);
    await checkPageLoaded(page, 'HIPAA Compliance (/compliance/hipaa)', `${BASE_URL}/compliance/hipaa`, null);

    // ── LOGIN FLOW ────────────────────────────────────────────────
    console.log('\n=== LOGIN FLOW ===');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 20000 });
    const loginBody = await page.evaluate(() => document.body?.innerText || '');
    if (!loginBody || loginBody.trim().length < 20) {
      const path = await screenshotOnFail(page, 'login-page');
      log('Login Page (/login)', 'FAIL', 'Login page blank', `screenshot: ${path}`);
    } else {
      log('Login Page (/login)', 'PASS', 'Login page loaded');

      try {
        const emailSelectors = [
          'input[type="email"]',
          'input[name="email"]',
          'input[placeholder*="email" i]',
          'input[id*="email" i]',
          '[data-testid*="email"]'
        ];
        let emailFilled = false;
        for (const sel of emailSelectors) {
          try {
            await page.waitForSelector(sel, { timeout: 3000 });
            await page.fill(sel, ADMIN_EMAIL);
            emailFilled = true;
            break;
          } catch { /* try next */ }
        }

        const passwordSelectors = [
          'input[type="password"]',
          'input[name="password"]',
          '[data-testid*="password"]'
        ];
        let pwFilled = false;
        for (const sel of passwordSelectors) {
          try {
            await page.waitForSelector(sel, { timeout: 3000 });
            await page.fill(sel, ADMIN_PASSWORD);
            pwFilled = true;
            break;
          } catch { /* try next */ }
        }

        if (emailFilled && pwFilled) {
          const submitSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Sign in")',
            'button:has-text("Login")',
            'button:has-text("Log in")',
          ];
          let submitted = false;
          for (const sel of submitSelectors) {
            try {
              await page.click(sel, { timeout: 3000 });
              submitted = true;
              break;
            } catch { /* try next */ }
          }

          if (submitted) {
            try {
              await page.waitForURL(`${BASE_URL}/admin**`, { timeout: 15000 });
              log('Login Flow', 'PASS', 'Login succeeded, redirected to /admin');
            } catch {
              const currentUrl = page.url();
              const bodyAfter = await page.evaluate(() => document.body?.innerText || '');
              if (bodyAfter.toLowerCase().includes('invalid') || bodyAfter.toLowerCase().includes('incorrect') || bodyAfter.toLowerCase().includes('error')) {
                const path = await screenshotOnFail(page, 'login-failed');
                log('Login Flow', 'FAIL', `Login failed — credentials or auth error`, `url: ${currentUrl}, screenshot: ${path}`);
              } else if (currentUrl.includes('/admin')) {
                log('Login Flow', 'PASS', 'Navigated to admin area');
              } else {
                const path = await screenshotOnFail(page, 'login-unexpected');
                log('Login Flow', 'WARN', `Unexpected post-login URL: ${currentUrl}`, `screenshot: ${path}`);
              }
            }
          } else {
            log('Login Flow', 'WARN', 'Could not find submit button');
          }
        } else {
          log('Login Flow', 'WARN', `Could not fill form fields (email: ${emailFilled}, pw: ${pwFilled})`);
        }
      } catch (err) {
        const path = await screenshotOnFail(page, 'login-error');
        log('Login Flow', 'FAIL', `Error: ${err.message.split('\n')[0]}`, `screenshot: ${path}`);
      }
    }

    // ── ADMIN PAGES ────────────────────────────────────────────────
    console.log('\n=== ADMIN PAGES ===');

    const adminPages = [
      { feature: 'Dashboard (/admin)', url: `${BASE_URL}/admin` },
      { feature: 'Agency Setup (/admin/agency)', url: `${BASE_URL}/admin/agency` },
      { feature: 'Staff Management (/admin/staff)', url: `${BASE_URL}/admin/staff` },
      { feature: 'Clients (/admin/clients)', url: `${BASE_URL}/admin/clients` },
      { feature: 'Authorizations (/admin/authorizations)', url: `${BASE_URL}/admin/authorizations` },
      { feature: 'Templates (/admin/templates)', url: `${BASE_URL}/admin/templates` },
      { feature: 'Assignments (/admin/assignments)', url: `${BASE_URL}/admin/assignments` },
      { feature: 'Visit Review (/admin/review)', url: `${BASE_URL}/admin/review` },
      { feature: 'Audit Events (/admin/audit-events)', url: `${BASE_URL}/admin/audit-events` },
      { feature: 'Audit Retention (/admin/audit-retention)', url: `${BASE_URL}/admin/audit-retention` },
      { feature: 'Learning Hub (/admin/learning)', url: `${BASE_URL}/admin/learning` },
      { feature: 'My Training (/admin/learning/portal)', url: `${BASE_URL}/admin/learning/portal` },
    ];

    for (const { feature, url } of adminPages) {
      try {
        const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
        const currentUrl = page.url();
        const httpStatus = response?.status() ?? 0;

        if (currentUrl.includes('/login')) {
          log(feature, 'FAIL', 'Redirected to login — not authenticated');
          continue;
        }

        if (httpStatus >= 500) {
          const path = await screenshotOnFail(page, feature);
          log(feature, 'FAIL', `HTTP ${httpStatus}`, `screenshot: ${path}`);
          continue;
        }

        const bodyText = await page.evaluate(() => document.body?.innerText || '');
        const hasContent = bodyText.trim().length > 30;

        if (!hasContent) {
          const path = await screenshotOnFail(page, feature);
          log(feature, 'FAIL', 'Blank or spinner-only page', `screenshot: ${path}`);
          continue;
        }

        const errorKeywords = ['Internal Server Error', 'Cannot GET', 'Application error', 'ECONNREFUSED'];
        const hasError = errorKeywords.some(kw => bodyText.includes(kw));
        if (hasError) {
          const path = await screenshotOnFail(page, feature);
          log(feature, 'FAIL', 'Server error on page', `screenshot: ${path}`);
          continue;
        }

        // Take a screenshot of each admin page
        await page.screenshot({ path: join(ARTIFACTS_DIR, `admin-${feature.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`), fullPage: false });
        log(feature, 'PASS', `Loaded OK (HTTP ${httpStatus})`);
      } catch (err) {
        const path = await screenshotOnFail(page, feature);
        log(feature, 'FAIL', `Error: ${err.message.split('\n')[0]}`, `screenshot: ${path}`);
      }
    }

    // ── STAFF INVITE FLOW ─────────────────────────────────────────
    console.log('\n=== STAFF INVITE FLOW ===');
    try {
      await page.goto(`${BASE_URL}/admin/staff`, { waitUntil: 'networkidle', timeout: 20000 });
      const currentUrl = page.url();

      if (currentUrl.includes('/login')) {
        log('Staff Invite Flow', 'FAIL', 'Not authenticated — cannot test invite flow');
      } else {
        await page.screenshot({ path: join(ARTIFACTS_DIR, 'staff-page-before-invite.png'), fullPage: true });

        const inviteButtonSelectors = [
          'button:has-text("Invite")',
          'button:has-text("Add Staff")',
          'button:has-text("New Staff")',
          'button:has-text("Add")',
          '[data-testid*="invite"]',
          '[data-testid*="add-staff"]',
          'a:has-text("Invite")',
        ];

        let inviteButtonFound = false;
        for (const sel of inviteButtonSelectors) {
          try {
            await page.waitForSelector(sel, { timeout: 3000 });
            await page.click(sel);
            inviteButtonFound = true;
            log('Staff Invite - Open Form', 'PASS', `Found and clicked invite button: "${sel}"`);
            break;
          } catch { /* try next */ }
        }

        if (!inviteButtonFound) {
          const hasEmailInput = await page.$('input[type="email"]');
          if (hasEmailInput) {
            inviteButtonFound = true;
            log('Staff Invite - Open Form', 'PASS', 'Invite form already visible on page');
          } else {
            await page.screenshot({ path: join(ARTIFACTS_DIR, 'staff-no-invite-button.png'), fullPage: true });
            log('Staff Invite - Open Form', 'WARN', 'Could not find invite button or form');
          }
        }

        if (inviteButtonFound) {
          await page.waitForTimeout(1000);

          const emailSelectors = ['input[type="email"]', 'input[name="email"]', 'input[placeholder*="email" i]'];
          let emailFilled = false;
          for (const sel of emailSelectors) {
            try {
              await page.waitForSelector(sel, { timeout: 4000 });
              await page.fill(sel, INVITE_EMAIL);
              emailFilled = true;
              break;
            } catch { /* try next */ }
          }

          if (emailFilled) {
            // Try to select caregiver role
            const roleSelectors = ['select[name="role"]', '[data-testid*="role"]', 'select'];
            for (const sel of roleSelectors) {
              try {
                const el = await page.$(sel);
                if (el) {
                  await page.selectOption(sel, { value: 'caregiver' });
                  break;
                }
              } catch { /* try next */ }
            }
            try { await page.click('text=caregiver', { timeout: 2000 }); } catch { /* no text button */ }

            await page.screenshot({ path: join(ARTIFACTS_DIR, 'invite-form-filled.png'), fullPage: true });

            // Set up API response interception BEFORE clicking submit
            const responsePromise = page.waitForResponse(
              resp => {
                const url = resp.url();
                const method = resp.request().method();
                return (url.includes('/invite') || url.includes('/staff')) && method !== 'GET';
              },
              { timeout: 12000 }
            ).catch(() => null);

            const submitSelectors = [
              'button[type="submit"]',
              'button:has-text("Send Invite")',
              'button:has-text("Invite")',
              'button:has-text("Submit")',
              'button:has-text("Save")',
              'button:has-text("Create")',
            ];
            let submitted = false;
            for (const sel of submitSelectors) {
              try {
                await page.click(sel, { timeout: 3000 });
                submitted = true;
                break;
              } catch { /* try next */ }
            }

            if (submitted) {
              const inviteApiResponse = await responsePromise;

              if (inviteApiResponse) {
                const status = inviteApiResponse.status();
                let body = null;
                try {
                  body = await inviteApiResponse.json();
                } catch {
                  body = await inviteApiResponse.text().catch(() => null);
                }
                const bodyStr = JSON.stringify(body);
                console.log(`\nInvite API Response (HTTP ${status}):`, bodyStr);

                const emailDelivery = body?.emailDelivery ?? body?.data?.emailDelivery ?? null;
                const inviteId = body?.id ?? body?.inviteId ?? body?.data?.id ?? 'unknown';

                if (status >= 200 && status < 300) {
                  if (emailDelivery === 'sent') {
                    log('Staff Invite Flow', 'PASS', `Invite created (ID: ${inviteId}), emailDelivery: "sent" — AWS SES WORKING`);
                  } else if (emailDelivery === 'not_configured') {
                    log('Staff Invite Flow', 'WARN', `Invite created (ID: ${inviteId}), emailDelivery: "not_configured" — AWS SES NOT configured`);
                  } else if (emailDelivery) {
                    log('Staff Invite Flow', 'WARN', `Invite created (ID: ${inviteId}), emailDelivery: "${emailDelivery}"`);
                  } else {
                    log('Staff Invite Flow', 'PASS', `Invite created (HTTP ${status}) | full response: ${bodyStr.substring(0, 300)}`);
                  }
                } else {
                  const path = await screenshotOnFail(page, 'invite-api-error');
                  log('Staff Invite Flow', 'FAIL', `API returned HTTP ${status}`, `response: ${bodyStr.substring(0, 200)}, screenshot: ${path}`);
                }
              } else {
                await page.waitForTimeout(2000);
                const pageText = await page.evaluate(() => document.body?.innerText || '');
                await page.screenshot({ path: join(ARTIFACTS_DIR, 'invite-after-submit.png'), fullPage: true });
                if (pageText.toLowerCase().includes('success') || pageText.toLowerCase().includes('invited') || pageText.toLowerCase().includes('sent')) {
                  log('Staff Invite Flow', 'PASS', 'Invite succeeded (success message on page)');
                } else if (pageText.toLowerCase().includes('error') || pageText.toLowerCase().includes('fail')) {
                  log('Staff Invite Flow', 'FAIL', 'Error message after submitting invite');
                } else {
                  log('Staff Invite Flow', 'WARN', 'Submitted but no API response captured and no clear success/error message');
                }
              }
            } else {
              await page.screenshot({ path: join(ARTIFACTS_DIR, 'invite-no-submit-button.png'), fullPage: true });
              log('Staff Invite Flow', 'WARN', 'Could not find submit button for invite form');
            }
          } else {
            await page.screenshot({ path: join(ARTIFACTS_DIR, 'invite-no-email-field.png'), fullPage: true });
            log('Staff Invite Flow', 'WARN', 'Could not find email field in invite form');
          }
        }
      }
    } catch (err) {
      const path = await screenshotOnFail(page, 'invite-flow-error');
      log('Staff Invite Flow', 'FAIL', `Unexpected error: ${err.message.split('\n')[0]}`, `screenshot: ${path}`);
    }

  } finally {
    await context.close();
    await browser.close();
  }

  // ── REPORT ────────────────────────────────────────────────────────
  console.log('\n\n======================================================');
  console.log('                 E2E TEST REPORT');
  console.log('======================================================');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;

  console.log(`\nSummary: ${passed} PASS | ${failed} FAIL | ${warned} WARN\n`);

  for (const r of results) {
    console.log(`  [${r.status}] ${r.feature}`);
    console.log(`         ${r.note}`);
    if (r.extra) console.log(`         ${r.extra}`);
  }

  if (consoleErrors.length > 0) {
    console.log('\n-- Console / Page Errors --');
    const uniqueErrors = [...new Set(consoleErrors)].slice(0, 20);
    uniqueErrors.forEach(e => console.log('  ' + e));
  } else {
    console.log('\n-- Console / Page Errors: None captured --');
  }

  console.log('\n======================================================');
  console.log(`Artifacts saved to: ${ARTIFACTS_DIR}`);

  const jsonPath = join(ARTIFACTS_DIR, 'e2e-results.json');
  writeFileSync(jsonPath, JSON.stringify({ results, consoleErrors, timestamp: new Date().toISOString() }, null, 2));
  console.log(`JSON results: ${jsonPath}`);
}

runTests().catch(err => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
