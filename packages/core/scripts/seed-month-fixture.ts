#!/usr/bin/env tsx
/**
 * Month-scale wipe-and-reseed for the App Store fixture caregiver.
 *
 * Extends reseed-fixture-caregiver.ts to a full month in BOTH directions,
 * for BOTH fixture caregiver identities (Keystone + Sunrise/RayCareLLC), so
 * the mobile app has rich data no matter which agency membership is active:
 *
 *   1. WIPES every assignment + dependent visit row for both identities
 *      (child tables first: claim_lines, evv_exceptions, visit_maintenance,
 *      sandata_exception_queue, then evv_visits, then assignments).
 *   2. Relocates every fixture client to the Bannon Crossings real-device
 *      testing address (100 m geofence) and ensures a T1019 authorization.
 *   3. Per identity, seeds:
 *        - PAST 30 days: 1-3 completed visits per day (assignment +
 *          evv_visits row). Roughly 1 in 5 is flagged with a canonical PA
 *          exception; most carry documented tasks + notes; some carry a
 *          stroke-vector client signature.
 *        - TODAY: three fixed visits (09:00, 13:00, 18:00 ET) plus one
 *          live-clockable visit starting ~15 minutes after the script runs,
 *          so the Today section always shows at least 3 cards and one of
 *          them can actually be clocked in.
 *        - NEXT 30 days: 1-3 scheduled visits per day, varied morning /
 *          afternoon / evening times, so the Schedule tab (days=30) has
 *          data on every single day.
 *
 * Times are computed in America/New_York regardless of machine timezone.
 * Rerun any day to re-center the dataset on that day.
 *
 * SAFETY GUARD: refuses the prod default branch unless
 * RAYHEALTH_ALLOW_PROD_FIXTURE_SEED=1 (dataset lives in fixture agencies
 * only; the override is expected for the App Store fixture account).
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL = "postgres://...?sslmode=require"
 *   $env:RAYHEALTH_ALLOW_PROD_FIXTURE_SEED = "1"
 *   npx tsx packages/core/scripts/seed-month-fixture.ts
 */
import knex, { type Knex } from 'knex';

const SUNRISE_CG = '00000000-0000-4000-8000-000000000002';
const KEYSTONE_CG = '00000000-0000-4000-8000-000000400001';

const uid = (n: number) => '00000000-0000-4000-8000-' + n.toString(16).padStart(12, '0');

// Existing deterministic fixture clients (update in place; never create new
// ones, so template FKs keep working).
const KEYSTONE_CLIENTS = [
  { id: uid(0x500001), tmpl: uid(0x510001), auth: uid(0x520001) },
  { id: uid(0x500002), tmpl: uid(0x510002), auth: uid(0x520002) },
  { id: uid(0x500003), tmpl: uid(0x510003), auth: uid(0x520003) },
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

const EXCEPTIONS: { type: string; reason: string }[] = [
  { type: 'late-clock-in', reason: 'Clock-in was recorded 21 minutes after the scheduled start time.' },
  { type: 'missing-location', reason: 'Clock-out GPS accuracy 118m exceeds the 100m threshold.' },
  { type: 'manual-entry', reason: 'Visit times were entered manually after a device failure and need coordinator review.' },
];

// Deterministic day shape: how many visits and at which ET hours. The cycle
// keys off the day offset so reruns on the same day produce the same layout.
const DAY_COUNTS = [2, 1, 3, 2, 1, 2, 3, 1, 2, 2, 3, 1, 2, 1];
const HOURS_BY_COUNT: Record<number, number[]> = { 1: [10], 2: [9, 15], 3: [9, 13, 18] };
function dayShape(offset: number): number[] {
  const count = DAY_COUNTS[((offset % DAY_COUNTS.length) + DAY_COUNTS.length) % DAY_COUNTS.length];
  return HOURS_BY_COUNT[count];
}

const PROD_PROXY_HOST = 'c-5.us-east-1.aws.neon.tech';
function assertNonProd(): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  let parsed: URL;
  try { parsed = new URL(url.replace(/^postgres(ql)?:\/\//, 'http://')); }
  catch { throw new Error('DATABASE_URL is not a valid URL.'); }
  const allow = process.env.RAYHEALTH_ALLOW_PROD_FIXTURE_SEED === '1';
  if (parsed.hostname.endsWith(PROD_PROXY_HOST) && !parsed.searchParams.has('branch') && !allow) {
    throw new Error('Refusing to reseed prod default branch without RAYHEALTH_ALLOW_PROD_FIXTURE_SEED=1.');
  }
}

// America/New_York time math, machine-timezone independent.
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
function nyTime(y: number, m: number, d: number, h: number, min = 0): Date {
  let guess = Date.UTC(y, m - 1, d, h, min);
  for (let i = 0; i < 2; i++) {
    const p = nyParts(new Date(guess));
    const asIf = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second ?? 0);
    guess += Date.UTC(y, m - 1, d, h, min) - asIf;
  }
  return new Date(guess);
}
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

    // Client display names for signature rows.
    const nameRows: { id: string; first_name: string; last_name: string }[] =
      await db('clients').whereIn('id', allClients.map((c) => c.id)).select('id', 'first_name', 'last_name');
    const clientName = new Map(nameRows.map((r) => [r.id, `${r.first_name} ${r.last_name}`]));

    // 3) Seed one identity: past 30 days, today, next 30 days.
    async function seedIdentity(
      label: string,
      caregiverId: string,
      clients: { id: string; tmpl: string }[],
      base: number,
    ) {
      let visitSeq = 0;
      let pastCount = 0;
      let upcomingCount = 0;

      // Past 30 days: completed visits.
      for (let d = -30; d <= -1; d++) {
        for (const h of dayShape(d)) {
          const i = visitSeq++;
          const client = clients[i % clients.length];
          const durH = 2 + (i % 3 === 0 ? 1 : 0);
          const start = at(d, h);
          const end = new Date(start.getTime() + durH * 3_600_000);
          const aId = uid(base + 0x10000 + i);
          const vId = uid(base + 0x20000 + i);
          const flagged = i % 5 === 2;
          const ex = flagged ? EXCEPTIONS[i % EXCEPTIONS.length] : null;

          await upsertAssignment(aId, caregiverId, client.tmpl, start, end);

          const lateIn = ex?.type === 'late-clock-in' ? 21 : (i * 7) % 6;
          const clockIn = new Date(start.getTime() + lateIn * 60_000);
          const clockOut = new Date(end.getTime() - ((i * 5) % 8) * 60_000);
          const outLoc = ex?.type === 'missing-location' ? { ...loc, accuracy: 118 } : loc;
          const withDocs = i % 3 !== 1;
          const withSig = !flagged && i % 4 === 0;
          await db('evv_visits').insert({
            id: vId,
            assignment_id: aId,
            caregiver_id: caregiverId,
            client_id: client.id,
            service_code: 'T1019',
            clock_in_time: clockIn.toISOString(),
            clock_out_time: clockOut.toISOString(),
            clock_in_location: JSON.stringify(loc),
            clock_out_location: JSON.stringify(outLoc),
            status: flagged ? 'flagged' : 'verified',
            ...(withDocs ? { tasks: JSON.stringify(TASK_SETS[i % TASK_SETS.length]), visit_note: NOTES[i % NOTES.length] } : {}),
            ...(withSig ? { signature: JSON.stringify({ ...SIGNATURE, signerName: clientName.get(client.id) ?? 'Client', signedAt: clockOut.toISOString() }) } : {}),
            created_at: db.fn.now(),
            updated_at: db.fn.now(),
          });
          if (ex) {
            await db('evv_exceptions')
              .insert({ id: uid(base + 0x30000 + i), visit_id: vId, exception_type: ex.type, reason: ex.reason, created_at: db.fn.now(), updated_at: db.fn.now() })
              .onConflict('id').merge({ exception_type: ex.type, reason: ex.reason, updated_at: db.fn.now() });
          }
          pastCount++;
        }
      }
      console.log(`✓ ${label}: ${pastCount} completed visits over the past 30 days`);

      // Today: three fixed visits so the Today section always has 3 cards.
      const todayHours = [9, 13, 18];
      for (let i = 0; i < todayHours.length; i++) {
        const client = clients[i % clients.length];
        const start = at(0, todayHours[i]);
        await upsertAssignment(uid(base + i), caregiverId, client.tmpl, start, new Date(start.getTime() + 2 * 3_600_000));
        upcomingCount++;
      }
      // Plus one live-clockable visit starting ~15 minutes from now.
      const liveStart = new Date(Math.ceil((Date.now() + 15 * 60_000) / 300_000) * 300_000);
      await upsertAssignment(uid(base + 0x40000), caregiverId, clients[0].tmpl, liveStart, new Date(liveStart.getTime() + 2 * 3_600_000));
      upcomingCount++;
      console.log(`✓ ${label}: today 09:00 / 13:00 / 18:00 ET + live visit at ${liveStart.toISOString()}`);

      // Next 30 days: scheduled visits on every single day.
      let upSeq = todayHours.length;
      for (let d = 1; d <= 30; d++) {
        for (const h of dayShape(d)) {
          const i = upSeq++;
          const client = clients[i % clients.length];
          const start = at(d, h);
          const durH = 2 + (i % 4 === 0 ? 1 : 0);
          await upsertAssignment(uid(base + i), caregiverId, client.tmpl, start, new Date(start.getTime() + durH * 3_600_000));
          upcomingCount++;
        }
      }
      console.log(`✓ ${label}: ${upcomingCount} scheduled visits from today through +30 days`);
    }

    await seedIdentity('Keystone', KEYSTONE_CG, KEYSTONE_CLIENTS, 0x800000);
    await seedIdentity('RayCareLLC', SUNRISE_CG, SUNRISE_CLIENTS, 0x900000);

    const [key] = await db('assignments').where('caregiver_id', KEYSTONE_CG).count('* as n');
    const [sun] = await db('assignments').where('caregiver_id', SUNRISE_CG).count('* as n');
    const [kv] = await db('evv_visits').where('caregiver_id', KEYSTONE_CG).count('* as n');
    const [sv] = await db('evv_visits').where('caregiver_id', SUNRISE_CG).count('* as n');
    console.log(`Done. Keystone: ${key.n} assignments / ${kv.n} visits. RayCareLLC: ${sun.n} assignments / ${sv.n} visits.`);
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error('Month seed failed:', err);
  process.exit(1);
});
