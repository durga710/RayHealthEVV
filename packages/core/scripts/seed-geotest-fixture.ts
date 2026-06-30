#!/usr/bin/env tsx
/**
 * Idempotent on-site geofence test fixture.
 *
 * Seeds a deterministic client at 5418 Bannon Crossings Dr, Louisville KY
 * (with a T1019 authorization, visit template, and a today assignment) for the
 * App Store fixture caregiver, so on-site geofence testing has a stable,
 * reproducible visit at a real physical address. All identifiers are fixed
 * UUIDs in the `…0000000000a1..a4` range so reruns upsert in place rather than
 * duplicating — this is the codified replacement for the ad-hoc Bannon rows we
 * inserted by hand during clock-in debugging.
 *
 * DEPENDS ON seed-app-store-fixture.ts having run first — it reuses that
 * fixture's agency (…0999) and caregiver (…0002).
 *
 * SAFETY GUARD — refuses to run against the prod default branch unless
 * RAYHEALTH_ALLOW_PROD_FIXTURE_SEED=1 is set (same shape as the App Store seed).
 *
 * Usage:
 *   export DATABASE_URL="postgres://...?sslmode=require"
 *   # prod default branch also needs:  export RAYHEALTH_ALLOW_PROD_FIXTURE_SEED=1
 *   npx tsx packages/core/scripts/seed-geotest-fixture.ts
 */
import { knex } from 'knex';

// Reused from the App Store fixture (must exist already).
const TEST_AGENCY_ID = '00000000-0000-4000-8000-000000000999';
const TEST_CAREGIVER_ID = '00000000-0000-4000-8000-000000000002';

// Deterministic geo-test fixture IDs.
const GEO_CLIENT_ID = '00000000-0000-4000-8000-0000000000a1';
const GEO_AUTH_ID = '00000000-0000-4000-8000-0000000000a2';
const GEO_TEMPLATE_ID = '00000000-0000-4000-8000-0000000000a3';
const GEO_ASSIGNMENT_ID = '00000000-0000-4000-8000-0000000000a4';

// 5418 Bannon Crossings Dr, Louisville KY 40218.
const GEO_LAT = 38.176689;
const GEO_LNG = -85.630423;
const GEO_RADIUS_M = 150;
const GEO_SERVICE_CODE = 'T1019'; // PA EVV personal care, per 15-min unit.

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
        'RAYHEALTH_ALLOW_PROD_FIXTURE_SEED=1 to override.'
    );
  }
}

async function main() {
  assertNonProd();

  const db = knex({
    client: 'pg',
    connection: process.env.DATABASE_URL!,
    pool: { min: 1, max: 2 },
  });

  try {
    console.log('Seeding on-site geofence test fixture (Bannon Crossings)…');

    // Client — TEST-Bannon Geotest at the real Louisville address.
    await db('clients')
      .insert({
        id: GEO_CLIENT_ID,
        agency_id: TEST_AGENCY_ID,
        first_name: 'TEST-Bannon',
        last_name: 'Geotest',
        address_line_1: '5418 Bannon Crossings Dr',
        city: 'Louisville',
        state: 'KY',
        postal_code: '40218',
        latitude: GEO_LAT,
        longitude: GEO_LNG,
        geofence_radius_m: GEO_RADIUS_M,
        status: 'active',
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .onConflict('id')
      .merge({
        address_line_1: '5418 Bannon Crossings Dr',
        city: 'Louisville',
        state: 'KY',
        postal_code: '40218',
        latitude: GEO_LAT,
        longitude: GEO_LNG,
        geofence_radius_m: GEO_RADIUS_M,
        updated_at: db.fn.now(),
      });

    // Authorization — clock-in resolves the HCPCS service code from here
    // (schedule-repository joins authorizations by client_id). Without it,
    // clock-in 400s with "serviceCode (HCPCS) is required at clock-in".
    await db('authorizations')
      .insert({
        id: GEO_AUTH_ID,
        client_id: GEO_CLIENT_ID,
        payer_id: 'MEDICAID',
        units_authorized: 1000,
        service_code: GEO_SERVICE_CODE,
        start_date: '2026-01-01',
        end_date: '2027-12-31',
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .onConflict('id')
      .merge({
        service_code: GEO_SERVICE_CODE,
        units_authorized: 1000,
        start_date: '2026-01-01',
        end_date: '2027-12-31',
        updated_at: db.fn.now(),
      });

    // Visit template.
    await db('visit_templates')
      .insert({
        id: GEO_TEMPLATE_ID,
        client_id: GEO_CLIENT_ID,
        name: 'TEST Geofence Personal Care',
        tasks: JSON.stringify(['Hygiene', 'Meal-Preparation']),
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .onConflict('id')
      .merge({ name: 'TEST Geofence Personal Care', updated_at: db.fn.now() });

    // Assignment — scheduled for today's window so it lands on "Today's Visits".
    const startTs = new Date();
    startTs.setMinutes(startTs.getMinutes() + 5);
    const endTs = new Date(startTs.getTime() + 4 * 60 * 60 * 1000);
    await db('assignments')
      .insert({
        id: GEO_ASSIGNMENT_ID,
        caregiver_id: TEST_CAREGIVER_ID,
        visit_template_id: GEO_TEMPLATE_ID,
        scheduled_start_time: startTs.toISOString(),
        scheduled_end_time: endTs.toISOString(),
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      })
      .onConflict('id')
      .merge({
        scheduled_start_time: startTs.toISOString(),
        scheduled_end_time: endTs.toISOString(),
        updated_at: db.fn.now(),
      });

    console.log('Geo-test seed complete.');
    console.log('  Client     :', GEO_CLIENT_ID, '(5418 Bannon Crossings Dr, Louisville KY)');
    console.log('  Authorization:', GEO_AUTH_ID, `(${GEO_SERVICE_CODE})`);
    console.log('  Template   :', GEO_TEMPLATE_ID);
    console.log('  Assignment :', GEO_ASSIGNMENT_ID);
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error('Geo-test seed failed:', err);
  process.exit(1);
});
