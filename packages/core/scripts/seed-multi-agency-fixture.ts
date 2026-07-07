#!/usr/bin/env tsx
/**
 * Multi-agency demo dataset for the App Store fixture caregiver.
 *
 * Builds on seed-fixture-schedule.ts (single-agency Sunrise data) and:
 *   • links the fixture user to a SECOND agency. Keystone Care Services LLC , 
 *     via user_agencies, with its own per-agency caregivers row (this is what
 *     the mobile agency picker / switch flow needs)
 *   • creates 3 Keystone clients (Pittsburgh coords, 15 m geofence), each with
 *     a T1019 authorization and a visit template
 *   • seeds ~20 UPCOMING Keystone assignments across the next 30 days and
 *     6 PAST Keystone visits (4 verified, 2 flagged with evv_exceptions)
 *   • extends the Sunrise schedule from 3 weeks to a full month (6 extra
 *     upcoming assignments on days 21-30)
 *
 * All identifiers are deterministic. reruns upsert in place.
 *
 * SAFETY GUARD. refuses to run against the prod default branch unless
 * RAYHEALTH_ALLOW_PROD_FIXTURE_SEED=1 is set (same contract as the other
 * fixture seeders).
 *
 * Usage:
 *   export DATABASE_URL="postgres://...?sslmode=require"
 *   # prod also needs:  export RAYHEALTH_ALLOW_PROD_FIXTURE_SEED=1
 *   npx tsx packages/core/scripts/seed-multi-agency-fixture.ts
 */
import knex from 'knex';

const FIXTURE_USER = '00000000-0000-4000-8000-000000000003';
const FIXTURE_EMAIL = 'test-caregiver-fixture@rayhealthevv.local';

const SUNRISE_AGENCY = 'e1c4a7e3-1cad-4001-8e0a-000000000001';
const SUNRISE_CG = '00000000-0000-4000-8000-000000000002';

const KEYSTONE_AGENCY = 'b2000000-0000-4000-8000-000000000099';
const KEYSTONE_CG = '00000000-0000-4000-8000-000000400001';

const GEOFENCE_M = 15;

const uid = (n: number) => '00000000-0000-4000-8000-' + n.toString(16).padStart(12, '0');

// Keystone clients. real Pittsburgh-area coordinates so the clock-in map
// renders sensibly, mirroring the Sunrise fixture clients.
const KEYSTONE_CLIENTS = [
  {
    id: uid(0x500001), tmpl: uid(0x510001), auth: uid(0x520001),
    firstName: 'Margaret', lastName: 'Okafor', dob: '1948-03-12',
    addr: '812 Brookline Blvd', city: 'Pittsburgh', lat: 40.3934, lng: -80.0231,
  },
  {
    id: uid(0x500002), tmpl: uid(0x510002), auth: uid(0x520002),
    firstName: 'Walter', lastName: 'Brennan', dob: '1941-11-02',
    addr: '2203 Murray Ave', city: 'Pittsburgh', lat: 40.4308, lng: -79.9229,
  },
  {
    id: uid(0x500003), tmpl: uid(0x510003), auth: uid(0x520003),
    firstName: 'Rosa', lastName: 'Delgado', dob: '1953-07-24',
    addr: '506 East Ohio St', city: 'Pittsburgh', lat: 40.4547, lng: -79.9999,
  },
];

// Upcoming Keystone visits: day offset + hour + client index (+ duration h).
const KEYSTONE_UPCOMING: Array<{ d: number; h: number; c: number; dur?: number }> = [
  { d: 0, h: 17, c: 0, dur: 2 },
  { d: 1, h: 8, c: 1 }, { d: 1, h: 13, c: 2, dur: 3 },
  { d: 2, h: 16, c: 0, dur: 2 },
  { d: 3, h: 8, c: 2 },
  { d: 4, h: 10, c: 1, dur: 3 },
  { d: 6, h: 9, c: 0 },
  { d: 7, h: 12, c: 2, dur: 2 },
  { d: 9, h: 8, c: 1 },
  { d: 10, h: 15, c: 0, dur: 3 },
  { d: 12, h: 9, c: 2 },
  { d: 14, h: 11, c: 1, dur: 2 },
  { d: 16, h: 8, c: 0 },
  { d: 18, h: 13, c: 2, dur: 3 },
  { d: 21, h: 9, c: 1 },
  { d: 23, h: 14, c: 0, dur: 2 },
  { d: 25, h: 8, c: 2 },
  { d: 27, h: 10, c: 1, dur: 3 },
  { d: 29, h: 9, c: 0 },
  { d: 30, h: 13, c: 2, dur: 2 },
];

// Past Keystone visits (completed history so Visits isn't empty post-switch).
const KEYSTONE_PAST: Array<{
  d: number; h: number; c: number; dur: number;
  status: 'verified' | 'flagged'; type?: string; reason?: string;
}> = [
  { d: -1, h: 8, c: 1, dur: 3, status: 'verified' },
  { d: -2, h: 14, c: 0, dur: 2, status: 'verified' },
  { d: -4, h: 9, c: 2, dur: 4, status: 'flagged', type: 'late_clock_in', reason: 'Clock-in was recorded 17 minutes after the scheduled start time.' },
  { d: -6, h: 10, c: 1, dur: 3, status: 'verified' },
  { d: -8, h: 8, c: 0, dur: 2, status: 'flagged', type: 'geofence', reason: "Clock-out location was 39 m outside the client's allowed zone." },
  { d: -11, h: 13, c: 2, dur: 3, status: 'verified' },
];

// Extra Sunrise assignments to stretch the calendar from 3 weeks to a month.
// Client indexes reference the Sunrise fixture clients (same order as
// seed-fixture-schedule.ts CLIENTS).
const SUNRISE_CLIENT_TMPLS = [
  '00000000-0000-4000-8000-000000000004',
  'b03f4f1a-dcd4-4874-a767-dc673df2eca8',
  '8ed86184-9ffc-4783-8c18-8818f539c5ae',
  'abe219e8-4655-4925-b0ec-9f4a1510dee8',
];
const SUNRISE_EXTRA: Array<{ d: number; h: number; c: number; dur?: number }> = [
  { d: 21, h: 9, c: 0 },
  { d: 23, h: 11, c: 1, dur: 3 },
  { d: 25, h: 10, c: 2 },
  { d: 27, h: 14, c: 3, dur: 2 },
  { d: 29, h: 9, c: 1 },
  { d: 30, h: 11, c: 0, dur: 3 },
];

const DEFAULT_TASKS = [
  { number: 1, description: 'Bathing / personal hygiene' },
  { number: 2, description: 'Meal preparation' },
  { number: 3, description: 'Light housekeeping' },
  { number: 4, description: 'Medication reminders' },
];

const PROD_PROXY_HOST = 'c-5.us-east-1.aws.neon.tech';
function assertNonProd(): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  let parsed: URL;
  try { parsed = new URL(url.replace(/^postgres(ql)?:\/\//, 'http://')); }
  catch { throw new Error('DATABASE_URL is not a valid URL.'); }
  const allow = process.env.RAYHEALTH_ALLOW_PROD_FIXTURE_SEED === '1';
  if (parsed.hostname === PROD_PROXY_HOST && !parsed.searchParams.has('branch') && !allow) {
    throw new Error('Refusing to seed prod default branch without RAYHEALTH_ALLOW_PROD_FIXTURE_SEED=1.');
  }
}

function atDay(d: number, h: number): Date {
  const t = new Date(); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + d); t.setHours(h); return t;
}

async function main() {
  assertNonProd();
  const db = knex({ client: 'pg', connection: process.env.DATABASE_URL!, pool: { min: 1, max: 2 } });

  async function upsertAssignment(id: string, caregiverId: string, tmpl: string, start: Date, end: Date) {
    await db('assignments')
      .insert({ id, caregiver_id: caregiverId, visit_template_id: tmpl, scheduled_start_time: start.toISOString(), scheduled_end_time: end.toISOString(), created_at: db.fn.now(), updated_at: db.fn.now() })
      .onConflict('id')
      .merge({ caregiver_id: caregiverId, visit_template_id: tmpl, scheduled_start_time: start.toISOString(), scheduled_end_time: end.toISOString(), updated_at: db.fn.now() });
  }

  try {
    // 0) Sanity: both agencies must exist and be approved.
    const agencies = await db('agencies').whereIn('id', [SUNRISE_AGENCY, KEYSTONE_AGENCY]).select('id', 'name', 'review_status');
    if (agencies.length !== 2) throw new Error(`Expected both fixture agencies to exist; found ${agencies.length}.`);
    for (const a of agencies) {
      if (a.review_status && a.review_status !== 'approved') throw new Error(`Agency ${a.name} is not approved (${a.review_status}).`);
    }
    console.log('✓ agencies present:', agencies.map((a) => a.name).join(' + '));

    // 1) Keystone caregivers row for the fixture person (per-agency record).
    await db('caregivers')
      .insert({ id: KEYSTONE_CG, agency_id: KEYSTONE_AGENCY, first_name: 'TEST-Roman', last_name: 'TEST-Ghimeray', email: FIXTURE_EMAIL, status: 'active', created_at: db.fn.now(), updated_at: db.fn.now() })
      .onConflict('id').merge({ agency_id: KEYSTONE_AGENCY, status: 'active', updated_at: db.fn.now() });
    console.log('✓ Keystone caregiver row ensured');

    // 2) user_agencies memberships. Sunrise (home, from backfill) + Keystone.
    for (const [agencyId, caregiverId] of [[SUNRISE_AGENCY, SUNRISE_CG], [KEYSTONE_AGENCY, KEYSTONE_CG]] as const) {
      await db('user_agencies')
        .insert({ user_id: FIXTURE_USER, agency_id: agencyId, caregiver_id: caregiverId, role: 'caregiver', status: 'active', created_at: db.fn.now(), updated_at: db.fn.now() })
        .onConflict(['user_id', 'agency_id']).merge({ caregiver_id: caregiverId, role: 'caregiver', status: 'active', updated_at: db.fn.now() });
    }
    console.log('✓ memberships ensured (Sunrise + Keystone)');

    // 3) Keystone clients + geofence + authorization + visit template.
    for (const c of KEYSTONE_CLIENTS) {
      await db('clients')
        .insert({
          id: c.id, agency_id: KEYSTONE_AGENCY, first_name: c.firstName, last_name: c.lastName,
          date_of_birth: c.dob, address_line_1: c.addr, city: c.city, state: 'PA', postal_code: '15210',
          latitude: c.lat, longitude: c.lng, geofence_radius_m: GEOFENCE_M,
          created_at: db.fn.now(), updated_at: db.fn.now(),
        })
        .onConflict('id')
        .merge({ latitude: c.lat, longitude: c.lng, geofence_radius_m: GEOFENCE_M, updated_at: db.fn.now() });

      await db('authorizations')
        .insert({ id: c.auth, client_id: c.id, payer_id: 'MEDICAID', units_authorized: 1000, service_code: 'T1019', start_date: '2026-01-01', end_date: '2027-12-31', created_at: db.fn.now(), updated_at: db.fn.now() })
        .onConflict('id').merge({ service_code: 'T1019', end_date: '2027-12-31', updated_at: db.fn.now() });

      await db('visit_templates')
        .insert({ id: c.tmpl, client_id: c.id, name: `${c.firstName} ${c.lastName}. Personal Care`, tasks: JSON.stringify(DEFAULT_TASKS), created_at: db.fn.now(), updated_at: db.fn.now() })
        .onConflict('id').merge({ name: `${c.firstName} ${c.lastName}. Personal Care`, updated_at: db.fn.now() });
    }
    console.log(`✓ ${KEYSTONE_CLIENTS.length} Keystone clients + authorizations + templates ensured`);

    // 4) Keystone upcoming assignments (month fill).
    for (let i = 0; i < KEYSTONE_UPCOMING.length; i++) {
      const e = KEYSTONE_UPCOMING[i];
      const start = atDay(e.d, e.h);
      const end = new Date(start.getTime() + (e.dur ?? 4) * 3_600_000);
      await upsertAssignment(uid(0x600000 + i), KEYSTONE_CG, KEYSTONE_CLIENTS[e.c].tmpl, start, end);
    }
    console.log(`✓ ${KEYSTONE_UPCOMING.length} Keystone upcoming assignments seeded`);

    // 5) Keystone past visits + exceptions for flagged ones.
    let flagged = 0;
    for (let i = 0; i < KEYSTONE_PAST.length; i++) {
      const e = KEYSTONE_PAST[i];
      const cl = KEYSTONE_CLIENTS[e.c];
      const start = atDay(e.d, e.h);
      const end = new Date(start.getTime() + e.dur * 3_600_000);
      const aId = uid(0x610000 + i);
      const vId = uid(0x620000 + i);
      await upsertAssignment(aId, KEYSTONE_CG, cl.tmpl, start, end);

      const inLoc = { lat: cl.lat, lng: cl.lng, accuracy: 8 };
      const outLoc = e.type === 'geofence' ? { lat: cl.lat, lng: cl.lng + 0.00045, accuracy: 9 } : { lat: cl.lat, lng: cl.lng, accuracy: 8 };
      await db('evv_visits')
        .insert({ id: vId, assignment_id: aId, caregiver_id: KEYSTONE_CG, client_id: cl.id, service_code: 'T1019', clock_in_time: start.toISOString(), clock_out_time: end.toISOString(), clock_in_location: JSON.stringify(inLoc), clock_out_location: JSON.stringify(outLoc), status: e.status, created_at: db.fn.now(), updated_at: db.fn.now() })
        .onConflict('id').merge({ status: e.status, clock_in_time: start.toISOString(), clock_out_time: end.toISOString(), updated_at: db.fn.now() });

      if (e.status === 'flagged') {
        flagged++;
        await db('evv_exceptions')
          .insert({ id: uid(0x630000 + i), visit_id: vId, exception_type: e.type!, reason: e.reason!, created_at: db.fn.now(), updated_at: db.fn.now() })
          .onConflict('id').merge({ exception_type: e.type!, reason: e.reason!, updated_at: db.fn.now() });
      }
    }
    console.log(`✓ ${KEYSTONE_PAST.length} Keystone past visits seeded (${flagged} flagged with reasons)`);

    // 6) Stretch Sunrise to a full month.
    for (let i = 0; i < SUNRISE_EXTRA.length; i++) {
      const e = SUNRISE_EXTRA[i];
      const start = atDay(e.d, e.h);
      const end = new Date(start.getTime() + (e.dur ?? 4) * 3_600_000);
      await upsertAssignment(uid(0x210000 + i), SUNRISE_CG, SUNRISE_CLIENT_TMPLS[e.c], start, end);
    }
    console.log(`✓ ${SUNRISE_EXTRA.length} extra Sunrise assignments seeded (month fill)`);

    const [sun] = await db('assignments').where('caregiver_id', SUNRISE_CG).count('* as n');
    const [key] = await db('assignments').where('caregiver_id', KEYSTONE_CG).count('* as n');
    const memberships = await db('user_agencies as ua')
      .join('agencies as a', 'a.id', 'ua.agency_id')
      .where('ua.user_id', FIXTURE_USER)
      .select('a.name', 'ua.status');
    console.log(`Done. Sunrise assignments: ${sun.n} · Keystone assignments: ${key.n}`);
    console.log('Memberships:', memberships.map((m) => `${m.name} (${m.status})`).join(' · '));
  } finally {
    await db.destroy();
  }
}

main().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
