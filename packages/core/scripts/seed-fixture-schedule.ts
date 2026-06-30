#!/usr/bin/env tsx
/**
 * Rich demo dataset for the App Store fixture caregiver
 * (00000000-0000-4000-8000-000000000002, agency e1c4a7e3-…-000000000001).
 *
 * Reuses the clients + visit templates that already exist in that agency and:
 *   • shrinks their geofence radius to 15 m (tighter for visual map testing)
 *   • ensures every used client has a T1019 authorization (clock-in needs one)
 *   • seeds ~16 UPCOMING assignments spread across the next 3 weeks so the
 *     Schedule calendar is populated
 *   • seeds 8 PAST completed visits — 5 verified, 3 flagged — each flagged one
 *     with an evv_exceptions row explaining why
 *
 * All identifiers are deterministic so reruns upsert in place. Run
 * cleanup-fixture-assignments.ts first for an exactly-this set.
 *
 * SAFETY GUARD — refuses to run against the prod default branch unless
 * RAYHEALTH_ALLOW_PROD_FIXTURE_SEED=1 is set.
 *
 * Usage:
 *   export DATABASE_URL="postgres://...?sslmode=require"
 *   # prod also needs:  export RAYHEALTH_ALLOW_PROD_FIXTURE_SEED=1
 *   npx tsx packages/core/scripts/seed-fixture-schedule.ts
 */
import knex from 'knex';

const CG = '00000000-0000-4000-8000-000000000002';
const NATIONAL_AUTH = '00000000-0000-4000-8000-0000000000b1';
const GEOFENCE_M = 15;

const uid = (n: number) => '00000000-0000-4000-8000-' + n.toString(16).padStart(12, '0');

// Existing clients (with coordinates) + a template that belongs to each.
const CLIENTS = [
  { id: '00000000-0000-4000-8000-000000000001', tmpl: '00000000-0000-4000-8000-000000000004', lat: 40.466, lng: -79.805 },     // National Dr, Pittsburgh
  { id: '6c8c49bd-7fd7-4c57-815a-0d82c350d9a8', tmpl: 'b03f4f1a-dcd4-4874-a767-dc673df2eca8', lat: 38.176689, lng: -85.630423 }, // Bannon Crossings, Louisville
  { id: 'c1000000-0000-4000-8000-000000000001', tmpl: '8ed86184-9ffc-4783-8c18-8818f539c5ae', lat: 40.4406, lng: -79.9959 },    // 123 Liberty Ave
  { id: 'c2000000-0000-4000-8000-000000000002', tmpl: 'abe219e8-4655-4925-b0ec-9f4a1510dee8', lat: 40.4543, lng: -79.9687 },    // 456 Penn Ave
];

// Upcoming visits. `m` = minutes-from-now (for the on-site Bannon test); else day+hour.
const UPCOMING: Array<{ m?: number; d?: number; h?: number; c: number; dur?: number }> = [
  { m: 5, c: 1 },          // Bannon, ~now (clock in on-site)
  { d: 0, h: 14, c: 0 },
  { d: 1, h: 10, c: 2 }, { d: 1, h: 15, c: 3 },
  { d: 2, h: 9, c: 1 },
  { d: 3, h: 11, c: 0 },
  { d: 4, h: 13, c: 2 },
  { d: 5, h: 9, c: 3 },
  { d: 7, h: 10, c: 1 },
  { d: 8, h: 14, c: 0 },
  { d: 9, h: 9, c: 2 },
  { d: 11, h: 12, c: 3 },
  { d: 13, h: 10, c: 1 },
  { d: 15, h: 9, c: 0 },
  { d: 18, h: 11, c: 2 },
  { d: 20, h: 14, c: 3 },
];

// Past completed visits. Flagged ones carry a reason.
const PAST: Array<{
  d: number; h: number; c: number; dur: number;
  status: 'verified' | 'flagged'; type?: string; reason?: string;
}> = [
  { d: -1, h: 9, c: 0, dur: 3, status: 'verified' },
  { d: -2, h: 10, c: 2, dur: 4, status: 'verified' },
  { d: -3, h: 9, c: 1, dur: 2, status: 'flagged', type: 'late_clock_in', reason: 'Clock-in was recorded 22 minutes after the scheduled start time.' },
  { d: -5, h: 13, c: 3, dur: 3, status: 'verified' },
  { d: -7, h: 9, c: 0, dur: 4, status: 'flagged', type: 'geofence', reason: "Clock-out location was 48 m outside the client's allowed zone." },
  { d: -9, h: 11, c: 2, dur: 2, status: 'verified' },
  { d: -12, h: 10, c: 1, dur: 3, status: 'flagged', type: 'gps_accuracy', reason: 'GPS accuracy was low (±92 m) at clock-in, so presence could not be confirmed.' },
  { d: -14, h: 9, c: 3, dur: 4, status: 'verified' },
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
    throw new Error(`Refusing to seed prod default branch without RAYHEALTH_ALLOW_PROD_FIXTURE_SEED=1.`);
  }
}

function atDay(d: number, h: number): Date {
  const t = new Date(); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + d); t.setHours(h); return t;
}

async function main() {
  assertNonProd();
  const db = knex({ client: 'pg', connection: process.env.DATABASE_URL!, pool: { min: 1, max: 2 } });

  async function upsertAssignment(id: string, tmpl: string, start: Date, end: Date) {
    await db('assignments')
      .insert({ id, caregiver_id: CG, visit_template_id: tmpl, scheduled_start_time: start.toISOString(), scheduled_end_time: end.toISOString(), created_at: db.fn.now(), updated_at: db.fn.now() })
      .onConflict('id')
      .merge({ caregiver_id: CG, visit_template_id: tmpl, scheduled_start_time: start.toISOString(), scheduled_end_time: end.toISOString(), updated_at: db.fn.now() });
  }

  try {
    // 1) Tighten geofence radius for visual testing.
    await db('clients').whereIn('id', CLIENTS.map((c) => c.id)).update({ geofence_radius_m: GEOFENCE_M, updated_at: db.fn.now() });
    console.log(`✓ geofence radius set to ${GEOFENCE_M} m on ${CLIENTS.length} clients`);

    // 2) Ensure National Dr has a T1019 authorization (the others already do).
    await db('authorizations')
      .insert({ id: NATIONAL_AUTH, client_id: CLIENTS[0].id, payer_id: 'MEDICAID', units_authorized: 1000, service_code: 'T1019', start_date: '2026-01-01', end_date: '2027-12-31', created_at: db.fn.now(), updated_at: db.fn.now() })
      .onConflict('id').merge({ service_code: 'T1019', end_date: '2027-12-31', updated_at: db.fn.now() });
    console.log('✓ National Dr T1019 authorization ensured');

    // 3) Upcoming assignments (calendar fill).
    for (let i = 0; i < UPCOMING.length; i++) {
      const e = UPCOMING[i];
      const start = e.m != null ? new Date(Date.now() + e.m * 60_000) : atDay(e.d!, e.h!);
      const end = new Date(start.getTime() + (e.dur ?? 4) * 3_600_000);
      await upsertAssignment(uid(0x200000 + i), CLIENTS[e.c].tmpl, start, end);
    }
    console.log(`✓ ${UPCOMING.length} upcoming assignments seeded`);

    // 4) Past visits (completed + flagged history).
    let flagged = 0;
    for (let i = 0; i < PAST.length; i++) {
      const e = PAST[i];
      const cl = CLIENTS[e.c];
      const start = atDay(e.d, e.h);
      const end = new Date(start.getTime() + e.dur * 3_600_000);
      const aId = uid(0x300000 + i);
      const vId = uid(0x310000 + i);
      await upsertAssignment(aId, cl.tmpl, start, end);

      const inLoc = { lat: cl.lat, lng: cl.lng, accuracy: e.type === 'gps_accuracy' ? 92 : 8 };
      // geofence flag → clock-out ~48 m east of the client.
      const outLoc = e.type === 'geofence' ? { lat: cl.lat, lng: cl.lng + 0.00055, accuracy: 9 } : { lat: cl.lat, lng: cl.lng, accuracy: 8 };
      await db('evv_visits')
        .insert({ id: vId, assignment_id: aId, caregiver_id: CG, client_id: cl.id, service_code: 'T1019', clock_in_time: start.toISOString(), clock_out_time: end.toISOString(), clock_in_location: JSON.stringify(inLoc), clock_out_location: JSON.stringify(outLoc), status: e.status, created_at: db.fn.now(), updated_at: db.fn.now() })
        .onConflict('id').merge({ status: e.status, clock_in_time: start.toISOString(), clock_out_time: end.toISOString(), updated_at: db.fn.now() });

      if (e.status === 'flagged') {
        flagged++;
        await db('evv_exceptions')
          .insert({ id: uid(0x320000 + i), visit_id: vId, exception_type: e.type!, reason: e.reason!, created_at: db.fn.now(), updated_at: db.fn.now() })
          .onConflict('id').merge({ exception_type: e.type!, reason: e.reason!, updated_at: db.fn.now() });
      }
    }
    console.log(`✓ ${PAST.length} past visits seeded (${flagged} flagged with reasons)`);

    const n = await db('assignments').where('caregiver_id', CG).count('* as n');
    console.log(`Done. Caregiver now has ${n[0].n} assignment(s).`);
  } finally {
    await db.destroy();
  }
}

main().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
