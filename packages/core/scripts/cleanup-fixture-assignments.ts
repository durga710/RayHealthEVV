#!/usr/bin/env tsx
/**
 * Wipes ALL assignments (and their dependent EVV visit rows) for the App Store
 * fixture caregiver, so the schedule can be re-seeded from a clean slate.
 *
 * Why this exists: during mobile clock-in debugging we inserted assignments
 * ad-hoc with random UUIDs (a Bannon Crossings geo-test client, extra National
 * Dr rows, etc). Those don't de-duplicate, so the caregiver's "today" schedule
 * accumulated 6+ visits with duplicates. This script clears them; re-running
 * seed-app-store-fixture.ts (idempotent, fixed UUIDs) then restores exactly one
 * known-good visit.
 *
 * Delete order respects the FKs into evv_visits (all RESTRICT / NO ACTION):
 *   claim_lines, evv_exceptions, visit_maintenance, sandata_exception_queue
 *   → evv_visits → assignments.
 *
 * SAFETY GUARD — refuses to run against the prod default branch unless
 * RAYHEALTH_ALLOW_PROD_FIXTURE_CLEANUP=1 is set (same shape as the seeder).
 *
 * Usage:
 *   export DATABASE_URL="postgres://...?sslmode=require"
 *   # prod default branch also needs:  export RAYHEALTH_ALLOW_PROD_FIXTURE_CLEANUP=1
 *   npx tsx packages/core/scripts/cleanup-fixture-assignments.ts
 */
import { knex, type Knex } from 'knex';

const TEST_CAREGIVER_ID = '00000000-0000-4000-8000-000000000002';
const PROD_PROXY_HOST = 'c-5.us-east-1.aws.neon.tech';

// evv_visits child tables (each FK is RESTRICT/NO ACTION, so they must go first).
const VISIT_CHILD_TABLES = [
  'claim_lines',
  'evv_exceptions',
  'visit_maintenance',
  'sandata_exception_queue',
] as const;

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
  const allowProdOverride = process.env.RAYHEALTH_ALLOW_PROD_FIXTURE_CLEANUP === '1';
  const looksLikeProdHost = parsed.hostname === PROD_PROXY_HOST;
  const hasBranchParam = parsed.searchParams.has('branch');
  if (looksLikeProdHost && !hasBranchParam && !allowProdOverride) {
    throw new Error(
      `Refusing to clean up: DATABASE_URL points at ${PROD_PROXY_HOST} ` +
        'without a `branch=` param. Run against a Neon branch, or set ' +
        'RAYHEALTH_ALLOW_PROD_FIXTURE_CLEANUP=1 to override.'
    );
  }
}

async function delIfTable(trx: Knex.Transaction, table: string, column: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const exists = await trx.schema.hasTable(table);
  if (!exists) return 0;
  return trx(table).whereIn(column, ids).del();
}

async function main() {
  assertNonProd();

  const db = knex({
    client: 'pg',
    connection: process.env.DATABASE_URL!,
    pool: { min: 1, max: 2 },
  });

  try {
    await db.transaction(async (trx) => {
      const assignmentIds: string[] = await trx('assignments')
        .where('caregiver_id', TEST_CAREGIVER_ID)
        .pluck('id');

      console.log(`Found ${assignmentIds.length} assignment(s) for the fixture caregiver.`);
      if (assignmentIds.length === 0) {
        console.log('Nothing to clean up.');
        return;
      }

      const visitIds: string[] = await trx('evv_visits')
        .whereIn('assignment_id', assignmentIds)
        .pluck('id');
      console.log(`  → ${visitIds.length} dependent evv_visits row(s).`);

      for (const table of VISIT_CHILD_TABLES) {
        const n = await delIfTable(trx, table, 'visit_id', visitIds);
        if (n > 0) console.log(`    deleted ${n} row(s) from ${table}`);
      }

      const visitsDeleted = visitIds.length
        ? await trx('evv_visits').whereIn('id', visitIds).del()
        : 0;
      console.log(`  → deleted ${visitsDeleted} evv_visits row(s).`);

      const assignmentsDeleted = await trx('assignments')
        .whereIn('id', assignmentIds)
        .del();
      console.log(`  → deleted ${assignmentsDeleted} assignment(s).`);
    });

    console.log('Cleanup complete. Re-run seed-app-store-fixture.ts to restore one clean visit.');
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
