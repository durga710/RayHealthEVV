#!/usr/bin/env tsx
/**
 * Idempotent App Store screenshot fixture seeder.
 *
 * Seeds a deterministic test agency + caregiver + client + visit
 * template + assignment so the App Store screenshot capture flow has
 * stable data to render. All identifiers are deterministic UUIDs in
 * the `00000000-0000-4000-8000-000000000001..0005` range so reruns
 * upsert in place rather than duplicating.
 *
 * SAFETY GUARDS. refuses to run if both are true:
 *   1. The DB hostname matches the known prod proxy
 *      (`c-5.us-east-1.aws.neon.tech` for project late-art-87716813)
 *   2. AND `DATABASE_URL` doesn't contain `branch=` in its query string
 *      (Neon branch URLs always include `branch=<id>`)
 *   3. AND `RAYHEALTH_ALLOW_PROD_FIXTURE_SEED=1` is NOT set
 *
 * Usage (against a Neon branch):
 *   export DATABASE_URL="postgres://...?sslmode=require&branch=br-cool-name-123"
 *   npx tsx packages/core/scripts/seed-app-store-fixture.ts
 *
 * Why this exists: the previous fixture data was inserted ad-hoc via
 * direct SQL against the prod default branch. RELEASE_PREP_GAPS.md
 * (CRIT items) calls for moving that data to a branch and codifying
 * the seed so it's reproducible.
 */
import { knex } from 'knex';
import bcrypt from 'bcryptjs';

const TEST_AGENCY_ID = '00000000-0000-4000-8000-000000000999';
const TEST_CLIENT_ID = '00000000-0000-4000-8000-000000000001';
const TEST_CAREGIVER_ID = '00000000-0000-4000-8000-000000000002';
const TEST_USER_ID = '00000000-0000-4000-8000-000000000003';
const TEST_TEMPLATE_ID = '00000000-0000-4000-8000-000000000004';
const TEST_ASSIGNMENT_ID = '00000000-0000-4000-8000-000000000005';
const TEST_ADMIN_USER_ID = '00000000-0000-4000-8000-000000000006';

const TEST_CAREGIVER_EMAIL = 'test-caregiver-fixture@rayhealthevv.local';
const TEST_CAREGIVER_PASSWORD = 'TestCaregiver2026!';
const TEST_ADMIN_EMAIL = 'admin-fixture@rayhealthevv.local';
const TEST_ADMIN_PASSWORD = 'TestAdmin2026!';

const PROD_PROXY_HOST = 'c-5.us-east-1.aws.neon.tech';

function assertNonProd(): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required.');
  }
  let parsed: URL;
  try {
    parsed = new URL(url.replace(/^postgres(ql)?:\/\//, 'http://'));
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }
  const allowProdOverride = process.env.RAYHEALTH_ALLOW_PROD_FIXTURE_SEED === '1';
  const looksLikeProdHost = parsed.hostname === PROD_PROXY_HOST;
  const hasBranchParam = parsed.searchParams.has('branch');
  if (looksLikeProdHost && !hasBranchParam && !allowProdOverride) {
    throw new Error(
      `Refusing to seed: DATABASE_URL points at ${PROD_PROXY_HOST} ` +
        'without a `branch=` param. Run against a Neon branch, or set ' +
        'RAYHEALTH_ALLOW_PROD_FIXTURE_SEED=1 to override (do not.)'
    );
  }
}

async function main() {
  assertNonProd();

  const db = knex({
    client: 'pg',
    connection: process.env.DATABASE_URL!,
    pool: { min: 1, max: 2 }
  });

  try {
    console.log('Seeding App Store fixture data…');

    // Agency. required for FK constraints on users + caregivers + clients.
    await db('agencies')
      .insert({
        id: TEST_AGENCY_ID,
        name: 'TEST Agency (App Store fixture)',
        state: 'PA',
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .onConflict('id')
      .merge({ name: 'TEST Agency (App Store fixture)', updated_at: db.fn.now() });

    // Client. TEST-Lok TEST-Ghimeray, 225 National Dr, Pittsburgh PA.
    await db('clients')
      .insert({
        id: TEST_CLIENT_ID,
        agency_id: TEST_AGENCY_ID,
        first_name: 'TEST-Lok',
        last_name: 'TEST-Ghimeray',
        address_line_1: '225 National Dr',
        city: 'Pittsburgh',
        state: 'PA',
        postal_code: '15235',
        latitude: 40.466,
        longitude: -79.805,
        geofence_radius_m: 150,
        status: 'active',
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .onConflict('id')
      .merge({
        address_line_1: '225 National Dr',
        city: 'Pittsburgh',
        state: 'PA',
        postal_code: '15235',
        latitude: 40.466,
        longitude: -79.805,
        geofence_radius_m: 150,
        updated_at: db.fn.now()
      });

    // Caregiver. TEST-Roman TEST-Ghimeray.
    await db('caregivers')
      .insert({
        id: TEST_CAREGIVER_ID,
        agency_id: TEST_AGENCY_ID,
        first_name: 'TEST-Roman',
        last_name: 'TEST-Ghimeray',
        email: TEST_CAREGIVER_EMAIL,
        phone: null,
        npi: 'enc:placeholder',
        hire_date: null,
        status: 'active',
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .onConflict('id')
      .merge({
        first_name: 'TEST-Roman',
        last_name: 'TEST-Ghimeray',
        updated_at: db.fn.now()
      });

    // User. caregiver login row, joined to caregivers via caregiver_id.
    const passwordHash = await bcrypt.hash(TEST_CAREGIVER_PASSWORD, 12);
    await db('users')
      .insert({
        id: TEST_USER_ID,
        agency_id: TEST_AGENCY_ID,
        email: TEST_CAREGIVER_EMAIL,
        password_hash: passwordHash,
        role: 'caregiver',
        caregiver_id: TEST_CAREGIVER_ID,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .onConflict('id')
      .merge({
        password_hash: passwordHash,
        caregiver_id: TEST_CAREGIVER_ID,
        updated_at: db.fn.now()
      });

    // Admin user. needed to exercise the web admin portal end-to-end
    // (Agency Setup, Visit Review, Audit Retention dashboard, Sandata
    // export, etc). All admin-only routes gate on capabilities the
    // 'admin' role grants in pennsylvania.ts.ROLE_CAPABILITIES. Same
    // agency as the caregiver fixture so admin sees the test schedule.
    const adminPasswordHash = await bcrypt.hash(TEST_ADMIN_PASSWORD, 12);
    await db('users')
      .insert({
        id: TEST_ADMIN_USER_ID,
        agency_id: TEST_AGENCY_ID,
        email: TEST_ADMIN_EMAIL,
        password_hash: adminPasswordHash,
        role: 'admin',
        caregiver_id: null,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .onConflict('id')
      .merge({
        password_hash: adminPasswordHash,
        updated_at: db.fn.now()
      });

    // Visit template. recurring daily personal-care plan.
    await db('visit_templates')
      .insert({
        id: TEST_TEMPLATE_ID,
        client_id: TEST_CLIENT_ID,
        name: 'TEST Daily Personal Care',
        tasks: JSON.stringify(['Hygiene', 'Managing-Medication', 'Meal-Preparation']),
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .onConflict('id')
      .merge({ name: 'TEST Daily Personal Care', updated_at: db.fn.now() });

    // Assignment. caregiver→template scheduled for today's window.
    const startTs = new Date();
    startTs.setMinutes(startTs.getMinutes() + 5);
    const endTs = new Date(startTs.getTime() + 4 * 60 * 60 * 1000);
    await db('assignments')
      .insert({
        id: TEST_ASSIGNMENT_ID,
        caregiver_id: TEST_CAREGIVER_ID,
        visit_template_id: TEST_TEMPLATE_ID,
        scheduled_start_time: startTs.toISOString(),
        scheduled_end_time: endTs.toISOString(),
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      })
      .onConflict('id')
      .merge({
        scheduled_start_time: startTs.toISOString(),
        scheduled_end_time: endTs.toISOString(),
        updated_at: db.fn.now()
      });

    console.log('Seed complete.');
    console.log('  Agency      :', TEST_AGENCY_ID);
    console.log('  Caregiver   :', TEST_CAREGIVER_ID, `(${TEST_CAREGIVER_EMAIL})`);
    console.log('  Client      :', TEST_CLIENT_ID, '(225 National Dr, Pittsburgh PA)');
    console.log('  Template    :', TEST_TEMPLATE_ID);
    console.log('  Assignment  :', TEST_ASSIGNMENT_ID);
    console.log('  Admin user  :', TEST_ADMIN_USER_ID, `(${TEST_ADMIN_EMAIL})`);
    console.log('');
    console.log(`Caregiver login : ${TEST_CAREGIVER_EMAIL}`);
    console.log(`Caregiver pass  : ${TEST_CAREGIVER_PASSWORD}`);
    console.log(`Admin login     : ${TEST_ADMIN_EMAIL}`);
    console.log(`Admin pass      : ${TEST_ADMIN_PASSWORD}`);
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
