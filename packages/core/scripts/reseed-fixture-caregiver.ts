#!/usr/bin/env tsx
/**
 * Wipe-and-reseed for the App Store fixture caregiver, relocated to the
 * owner's real-device testing address: 5418 Bannon Crossings Drive,
 * Louisville KY 40218 (38.176689, -85.630423).
 *
 * What it does, in one transaction-per-phase:
 *   1. WIPES every assignment + dependent visit rows for BOTH fixture
 *      caregiver identities (Sunrise/RayCareLLC + Keystone), child tables
 *      first (claim_lines, evv_exceptions, visit_maintenance,
 *      sandata_exception_queue → evv_visits → assignments).
 *   2. Relocates every fixture client (both agencies) to the Bannon
 *      Crossings address with a 100 m geofence (the old 15 m test radius is
 *      flaky on real phones indoors) and ensures a T1019 authorization each.
 *   3. Seeds Keystone (the active membership) with:
 *        - TONIGHT 23:00–23:59 America/New_York — the live clock-in test
 *          (window opens 22:55)
 *        - today 09:00–10:00 with no visit — exercises the expired gate
 *        - ~8 upcoming visits over the next week — too-early gate + schedule
 *        - 8 completed visits over the past 14 days (5 verified, 3 flagged
 *          with canonical PA exception types), several carrying documented
 *          tasks + notes and one a stroke-vector signature, so every
 *          documentation surface has data
 *      and RayCareLLC with 2 upcoming visits (keeps agency switching testable).
 *
 * Times are computed in America/New_York regardless of the machine timezone
 * (two-pass Intl offset resolution). The 23:00 visit is seeded for the
 * NY-local day the script RUNS — rerun it on a new test day.
 *
 * SAFETY GUARD: refuses the prod default branch unless
 * RAYHEALTH_ALLOW_PROD_FIXTURE_SEED=1 (this dataset lives in fixture agencies
 * only; the guard override is expected for the App Store fixture account).
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL = "postgres://...?sslmode=require"
 *   $env:RAYHEALTH_ALLOW_PROD_FIXTURE_SEED = "1"
 *   npx tsx packages/core/scripts/reseed-fixture-caregiver.ts
 */
import knex, { type Knex } from 'knex';

const SUNRISE_CG = '00000000-0000-4000-8000-000000000002';
const KEYSTONE_CG = '00000000-0000-4000-8000-000000400001';

const uid = (n: number) => '00000000-0000-4000-8000-' + n.toString(16).padStart(12, '0');

// Existing deterministic fixture clients (do NOT create new ones; update in
// place so template FKs keep working).
const KEYSTONE_CLIENTS = [
  { id: uid(0x500001), tmpl: uid(0x510001), auth: uid(0x520001), name: 'Margaret Okafor' },
  { id: uid(0x500002), tmpl: uid(0x510002), auth: uid(0x520002), name: 'Walter Brennan' },
  { id: uid(0x500003), tmpl: uid(0x510003), auth: uid(0x520003), name: 'Rosa Delgado' },
];
const SUNRISE_CLIENTS = [
  { id: '00000000-0000-4000-8000-000000000001', tmpl: '00000000-0000-4000-8000-000000000004', auth: uid(0x7a0001) },
  { id: '6c8c49bd-7fd7-4c57-815a-0d82c350d9a8', tmpl: 'b03f4f1a-dcd4-4874-a767-dc673df2eca8', auth: uid(0x7a0002) },
  { id: 'c1000000-0000-4000-8000-000000000001', tmpl: '8ed86184-9ffc-4783-8c18-8818f539c5ae', auth: uid(0x7a0003) },
  { id: 'c2000000-0000-4000-8000-000000000002', tmpl: 'abe219e8-4655-4925-b0ec-9f4a1510dee8', auth: uid(0x7a0004) },
];

const BANNON = {
  addressLine1: '5418 Bannon Crossings Drive',
  city: 'Louisville',
  state: 'KY',
  postalCode: '40218',
  lat: 38.176689,
  lng: -85.630423,
  geofenceM: 100,
};

// Documentation samples in the exact stored shapes (see domain/evv.ts).
const TASK_SETS: { id: string; duty: string }[][] = [
  [{ id: '134', duty: 'Bathing' }, { id: '115', duty: 'Meal-Preparation' }, { id: '246', duty: 'Medication Reminders' }],
  [{ id: '213', duty: 'Dressing' }, { id: '249', duty: 'Light Housekeeping' }],
  [{ id: '229', duty: 'Assist with walking' }, { id: '225', duty: 'Assist with feeding' }, { id: '138', duty: 'Laundry' }],
  [{ id: '208', duty: 'Mouth Care/Denture Care' }, { id: '214', duty: 'Skin Care' }],
  [{ id: '221', duty: 'Prepare-Breakfast' }, { id: '116', duty: 'Housework-Chores' }, { id: '244', duty: 'Remind to take medication' }],
];
const NOTES = [
  'Client ate a full breakfast and walked to the mailbox with the rollator. No concerns.',
  'Skin check done during dressing, no redness. Client in good spirits.',
  'Reminded client about the 2pm medication. Kitchen and bathroom tidied.',
  'Client a little tired today, napped after lunch. Appetite normal.',
  'Assisted with shower safely. Grab bar in the tub is loose, office notified.',
];
const SIGNATURE = {
  strokes: [
    [[18, 92], [42, 58], [66, 96], [92, 52], [118, 90]],
    [[132, 74], [150, 70], [168, 78], [186, 68], [210, 76], [240, 64], [268, 78]],
  ],
  width: 320,
  height: 140,
  signerRole: 'client',
};

// Past-history shape: day offset (NY), start hour, client index, duration h,
// status, optional canonical PA exception, optional documentation index.
const PAST: {
  d: number; h: number; c: number; dur: number;
  status: 'verified' | 'flagged';
  exType?: 'late-clock-in' | 'missing-location' | 'manual-entry';
  exReason?: string;
  doc?: number; sig?: boolean;
}[] = [
  { d: -1, h: 9, c: 0, dur: 2, status: 'verified', doc: 0, sig: true },
  { d: -2, h: 13, c: 1, dur: 3, status: 'verified', doc: 1 },
  { d: -3, h: 9, c: 2, dur: 2, status: 'flagged', exType: 'late-clock-in', exReason: 'Clock-in was recorded 21 minutes after the scheduled start time.', doc: 2 },
  { d: -5, h: 10, c: 0, dur: 2, status: 'verified', doc: 3 },
  { d: -7, h: 14, c: 1, dur: 2, status: 'flagged', exType: 'missing-location', exReason: 'Clock-out GPS accuracy 118m exceeds the 100m threshold.' },
  { d: -9, h: 9, c: 2, dur: 3, status: 'verified', doc: 4 },
  { d: -11, h: 11, c: 0, dur: 2, status: 'flagged', exType: 'manual-entry', exReason: 'Visit times were entered manually after a device failure and need coordinator review.' },
  { d: -13, h: 9, c: 1, dur: 2, status: 'verified' },
];

// Upcoming week (beyond tonight): day offset, hour, client index, duration h.
const UPCOMING: { d: number; h: number; c: number; dur: number }[] = [
  { d: 1, h: 9, c: 0, dur: 2 },
  { d: 1, h: 15, c: 1, dur: 2 },
  { d: 2, h: 10, c: 2, dur: 2 },
  { d: 3, h: 9, c: 0, dur: 2 },
  { d: 4, h: 13, c: 1, dur: 2 },
  { d: 5, h: 9, c: 2, dur: 3 },
  { d: 6, h: 11, c: 0, dur: 2 },
  { d: 7, h: 9, c: 1, dur: 2 },
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
    throw new Error('Refusing to reseed prod default branch without RAYHEALTH_ALLOW_PROD_FIXTURE_SEED=1.');
  }
}

// ── America/New_York time math, machine-timezone independent ────────────────
const NY_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});
function nyParts(at: Date): Record<string, number> {
  const parts: Record<string, number> = {};
  for (const p of NY_FMT.formatToParts(at)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  if (parts.hour === 24) parts.hour = 0;
  return parts;
}
/** The UTC instant for a wall-clock time in America/New_York (two-pass). */
function nyTime(y: number, m: number, d: number, h: number, min = 0): Date {
  let guess = Date.UTC(y, m - 1, d, h, min);
  for (let i = 0; i < 2; i++) {
    const p = nyParts(new Date(guess));
    const asIf = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second ?? 0);
    guess += Date.UTC(y, m - 1, d, h, min) - asIf;
  }
  return new Date(guess);
}
/** Today's NY calendar date plus a day offset. */
function nyDay(offsetDays: number): { y: number; m: number; d: number } {
  const p = nyParts(new Date(Date.now() + offsetDays * 86_400_000));
  return { y: p.year, m: p.month, d: p.day };
}
function at(offsetDays: number, hour: number, minute = 0): Date {
  const { y, m, d } = nyDay(offsetDays);
  return nyTime(y, m, d, hour, minute);
}

const VISIT_CHILD_TABLES = ['claim_lines', 'evv_exceptions', 'visit_maintenance', 'sandata_exception_queue'] as const;
async function delIfTable(trx: Knex.Transaction, table: string, column: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  if (!(await trx.schema.hasTable(table))) return 0;
  return trx(table).whereIn(column, ids).del();
}

async function main() {
  assertNonProd();
  const db = knex({ client: 'pg', connection: process.env.DATABASE_URL!, pool: { min: 1, max: 2 } });

  const loc = { lat: BANNON.lat, lng: BANNON.lng, accuracy: 8 };

  async function upsertAssignment(id: string, caregiverId: string, tmpl: string, start: Date, end: Date) {
    await db('assignments')
      .insert({ id, caregiver_id: caregiverId, visit_template_id: tmpl, scheduled_start_time: start.toISOString(), scheduled_end_time: end.toISOString(), created_at: db.fn.now(), updated_at: db.fn.now() })
      .onConflict('id')
      .merge({ caregiver_id: caregiverId, visit_template_id: tmpl, scheduled_start_time: start.toISOString(), scheduled_end_time: end.toISOString(), updated_at: db.fn.now() });
  }

  try {
    // 1) Wipe both caregivers' schedule + visit data.
    await db.transaction(async (trx) => {
      for (const cg of [SUNRISE_CG, KEYSTONE_CG]) {
        const assignmentIds: string[] = await trx('assignments').where('caregiver_id', cg).pluck('id');
        const visitIds: string[] = assignmentIds.length
          ? await trx('evv_visits').whereIn('assignment_id', assignmentIds).pluck('id')
          : [];
        for (const table of VISIT_CHILD_TABLES) await delIfTable(trx, table, 'visit_id', visitIds);
        if (visitIds.length) await trx('evv_visits').whereIn('id', visitIds).del();
        if (assignmentIds.length) await trx('assignments').whereIn('id', assignmentIds).del();
        console.log(`✓ wiped caregiver ${cg.slice(-6)}: ${assignmentIds.length} assignments, ${visitIds.length} visits`);
      }
    });

    // 2) Relocate every fixture client to Bannon Crossings + ensure T1019.
    const allClients = [...KEYSTONE_CLIENTS, ...SUNRISE_CLIENTS];
    await db('clients')
      .whereIn('id', allClients.map((c) => c.id))
      .update({
        address_line_1: BANNON.addressLine1,
        address_line_2: null,
        city: BANNON.city,
        state: BANNON.state,
        postal_code: BANNON.postalCode,
        latitude: BANNON.lat,
        longitude: BANNON.lng,
        geofence_radius_m: BANNON.geofenceM,
        updated_at: db.fn.now(),
      });
    for (const c of allClients) {
      await db('authorizations')
        .insert({ id: c.auth, client_id: c.id, payer_id: 'MEDICAID', units_authorized: 1000, service_code: 'T1019', start_date: '2026-01-01', end_date: '2027-12-31', created_at: db.fn.now(), updated_at: db.fn.now() })
        .onConflict('id').merge({ service_code: 'T1019', end_date: '2027-12-31', updated_at: db.fn.now() });
    }
    console.log(`✓ ${allClients.length} clients relocated to ${BANNON.addressLine1} (geofence ${BANNON.geofenceM}m), T1019 ensured`);

    // 3) Keystone: tonight's live test + today's expired + upcoming + history.
    const tonight = at(0, 23);
    const tonightEnd = at(0, 23, 59);
    await upsertAssignment(uid(0x700001), KEYSTONE_CG, KEYSTONE_CLIENTS[0].tmpl, tonight, tonightEnd);
    console.log(`✓ tonight's test visit: ${KEYSTONE_CLIENTS[0].name} ${tonight.toISOString()} → ${tonightEnd.toISOString()} (opens 22:55 ET)`);

    await upsertAssignment(uid(0x700002), KEYSTONE_CG, KEYSTONE_CLIENTS[1].tmpl, at(0, 9), at(0, 10));
    console.log('✓ today 09:00–10:00 ET expired-gate visit (never clocked in)');

    for (let i = 0; i < UPCOMING.length; i++) {
      const e = UPCOMING[i];
      await upsertAssignment(uid(0x700100 + i), KEYSTONE_CG, KEYSTONE_CLIENTS[e.c].tmpl, at(e.d, e.h), new Date(at(e.d, e.h).getTime() + e.dur * 3_600_000));
    }
    console.log(`✓ ${UPCOMING.length} upcoming Keystone visits over the next week`);

    for (let i = 0; i < PAST.length; i++) {
      const e = PAST[i];
      const cl = KEYSTONE_CLIENTS[e.c];
      const start = at(e.d, e.h);
      const end = new Date(start.getTime() + e.dur * 3_600_000);
      const aId = uid(0x710000 + i);
      const vId = uid(0x720000 + i);
      await upsertAssignment(aId, KEYSTONE_CG, cl.tmpl, start, end);
      const outLoc = e.exType === 'missing-location' ? { ...loc, accuracy: 118 } : loc;
      await db('evv_visits').insert({
        id: vId,
        assignment_id: aId,
        caregiver_id: KEYSTONE_CG,
        client_id: cl.id,
        service_code: 'T1019',
        clock_in_time: start.toISOString(),
        clock_out_time: end.toISOString(),
        clock_in_location: JSON.stringify(loc),
        clock_out_location: JSON.stringify(outLoc),
        status: e.status,
        ...(e.doc != null ? { tasks: JSON.stringify(TASK_SETS[e.doc]), visit_note: NOTES[e.doc] } : {}),
        ...(e.sig ? { signature: JSON.stringify({ ...SIGNATURE, signerName: cl.name, signedAt: end.toISOString() }) } : {}),
        created_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
      if (e.status === 'flagged' && e.exType) {
        await db('evv_exceptions')
          .insert({ id: uid(0x730000 + i), visit_id: vId, exception_type: e.exType, reason: e.exReason ?? 'Flagged for review.', created_at: db.fn.now(), updated_at: db.fn.now() })
          .onConflict('id').merge({ exception_type: e.exType, reason: e.exReason ?? 'Flagged for review.', updated_at: db.fn.now() });
      }
    }
    console.log(`✓ ${PAST.length} completed Keystone visits over the past 2 weeks (docs + signature included)`);

    // 4) RayCareLLC (Sunrise): two upcoming visits for agency switching.
    await upsertAssignment(uid(0x740001), SUNRISE_CG, SUNRISE_CLIENTS[1].tmpl, at(1, 10), new Date(at(1, 10).getTime() + 2 * 3_600_000));
    await upsertAssignment(uid(0x740002), SUNRISE_CG, SUNRISE_CLIENTS[0].tmpl, at(3, 14), new Date(at(3, 14).getTime() + 2 * 3_600_000));
    console.log('✓ 2 upcoming RayCareLLC visits (agency switching)');

    const [key] = await db('assignments').where('caregiver_id', KEYSTONE_CG).count('* as n');
    const [sun] = await db('assignments').where('caregiver_id', SUNRISE_CG).count('* as n');
    console.log(`Done. Keystone assignments: ${key.n}, RayCareLLC assignments: ${sun.n}.`);
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error('Reseed failed:', err);
  process.exit(1);
});
