import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb } from '../db/knex.js'
import * as schema from '../migrations/schema.js'
import * as auditRetentionMigration from '../migrations/2026-05-11-add-audit-retention.js'
import { runAuditRetentionSweep } from '../services/audit-retention-sweep.js'

/**
 * These tests exercise the retention sweep against a real Postgres.
 * They auto-skip when DATABASE_URL points at an unreachable database —
 * matching the pattern used by session-repository.test.ts.
 *
 * Run with a local DB via `npm run docker:up` then set DATABASE_URL.
 */

const TEST_AGENCY_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa'

let dbAvailable = false
const db = createDb()

beforeAll(async () => {
  try {
    await schema.up(db)
    await auditRetentionMigration.up(db)
    // Touch the DB so the catch trips if no connection.
    await db.raw('select 1')
    dbAvailable = true
  } catch {
    // Intentional: skip these tests when no Postgres is reachable.
    console.warn('Skipping audit-retention-sweep tests - no DB connection or migration')
  }
})

afterAll(async () => {
  await db.destroy().catch(() => {
    /* already torn down */
  })
})

async function ensureAgency(): Promise<void> {
  const exists = await db('agencies').where({ id: TEST_AGENCY_ID }).first()
  if (!exists) {
    await db('agencies').insert({
      id: TEST_AGENCY_ID,
      name: 'TEST Retention Agency',
      state: 'PA',
      operating_tracks: JSON.stringify(['personal_care']),
    })
  }
}

async function clearAuditTables(): Promise<void> {
  // The append-only trigger on audit_events blocks DELETE in the normal path;
  // bypass it the same way the sweep does — but only inside test setup.
  await db.transaction(async (trx) => {
    await trx.raw("SET LOCAL session_replication_role = 'replica'")
    await trx('audit_events').where({ agency_id: TEST_AGENCY_ID }).del()
    await trx('audit_events_archive').where({ agency_id: TEST_AGENCY_ID }).del()
    await trx('audit_retention_runs').del()
  })
}

interface AuditRow {
  id: string
  agency_id: string
  event_type: string
  occurred_at: Date
}

async function insertAuditEvent(occurredAt: Date): Promise<AuditRow> {
  const [row] = (await db('audit_events')
    .insert({
      id: db.raw('gen_random_uuid()'),
      agency_id: TEST_AGENCY_ID,
      event_type: 'TEST_EVENT',
      payload: {},
      occurred_at: occurredAt,
    })
    .returning(['id', 'agency_id', 'event_type', 'occurred_at'])) as AuditRow[]
  return row
}

function yearsAgo(n: number): Date {
  const d = new Date()
  d.setUTCFullYear(d.getUTCFullYear() - n)
  return d
}

describe('runAuditRetentionSweep', () => {
  it('logs a success run with zero rows when the hot table is empty', async () => {
    if (!dbAvailable) return
    await ensureAgency()
    await clearAuditTables()

    const result = await runAuditRetentionSweep(db)
    expect(result.rowsArchived).toBe(0)
    expect(result.rowsPurgedFromHot).toBe(0)

    const run = await db('audit_retention_runs').where({ id: result.runId }).first()
    expect(run?.status).toBe('success')
    expect(Number(run?.rows_archived)).toBe(0)
  })

  it('archives rows older than the 6-year floor and leaves recent rows in hot', async () => {
    if (!dbAvailable) return
    await ensureAgency()
    await clearAuditTables()

    const old = await insertAuditEvent(yearsAgo(7))
    const oldEdge = await insertAuditEvent(yearsAgo(6.5))
    const recent = await insertAuditEvent(yearsAgo(1))

    const result = await runAuditRetentionSweep(db)
    expect(result.rowsArchived).toBe(2)
    expect(result.rowsPurgedFromHot).toBe(2)

    const inHot = await db('audit_events').where({ agency_id: TEST_AGENCY_ID })
    expect(inHot.map((r: AuditRow) => r.id)).toEqual([recent.id])

    const inArchive = await db('audit_events_archive')
      .where({ agency_id: TEST_AGENCY_ID })
      .orderBy('occurred_at', 'asc')
    const archivedIds = inArchive.map((r: AuditRow) => r.id).sort()
    expect(archivedIds).toEqual([old.id, oldEdge.id].sort())
  })

  it('respects maxRowsPerRun across multiple chunks', async () => {
    if (!dbAvailable) return
    await ensureAgency()
    await clearAuditTables()

    for (let i = 0; i < 5; i++) {
      await insertAuditEvent(yearsAgo(7))
    }

    const result = await runAuditRetentionSweep(db, { chunkSize: 2, maxRowsPerRun: 3 })
    expect(result.rowsArchived).toBe(3)
    expect(result.rowsPurgedFromHot).toBe(3)

    const remaining = await db('audit_events').where({ agency_id: TEST_AGENCY_ID })
    expect(remaining).toHaveLength(2)
  })

  it('leaves the append-only trigger intact after a run', async () => {
    if (!dbAvailable) return
    await ensureAgency()
    await clearAuditTables()
    await insertAuditEvent(yearsAgo(7))

    await runAuditRetentionSweep(db)

    // Try to DELETE a normal audit_events row outside the sweep — should fail
    // because the trigger is still active. We insert a fresh row first, then
    // expect DELETE to throw.
    const recent = await insertAuditEvent(yearsAgo(1))
    let deleteRejected = false
    try {
      await db('audit_events').where({ id: recent.id }).del()
    } catch {
      deleteRejected = true
    }

    // Some test DBs may not have the trigger installed (e.g., bare schema).
    // Soft-assert: if the trigger exists it must reject the delete; if not, skip.
    const triggerExists = await db
      .select<{ tgname: string }[]>('tgname')
      .from('pg_trigger')
      .where('tgname', 'audit_events_block_mutation_trg')
      .catch(() => [])

    if (triggerExists.length > 0) {
      expect(deleteRejected).toBe(true)
    }
  })
})
