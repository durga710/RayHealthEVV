/**
 * Audit retention sweep.
 *
 * Moves audit_events rows older than the configured retention floor (default
 * 7 years — PA_RETENTION_YEARS, which exceeds the HIPAA §164.530(j)(2) 6-year
 * floor and is the conservative nationwide default) from the hot
 * `audit_events` table to the cold `audit_events_archive` table, then deletes
 * them from `audit_events`.
 *
 * Why this exists
 *   - `audit_events` is append-only by trigger (no UPDATE, no DELETE allowed
 *     in the normal path) so the trigger has to be temporarily disabled
 *     inside a transaction for the move. This module encapsulates that
 *     pattern safely.
 *   - Every run is logged to `audit_retention_runs` so an auditor can verify
 *     the job is actually running, not just configured.
 *   - The sweep is chunked (default 1000 rows per chunk) so a multi-year
 *     backlog doesn't lock the table.
 *
 * Run with:
 *   tsx packages/app/src/scripts/run-audit-retention-sweep.ts
 * Or schedule via cron / Vercel Cron / GitHub Actions (recommended: nightly
 * at 02:00 America/New_York).
 */

import type { Knex } from 'knex'
import { PA_RETENTION_YEARS } from '../config/pennsylvania.js'

export interface AuditRetentionSweepOptions {
  /**
   * Retention floor in years. Default {@link PA_RETENTION_YEARS} (7) — PA's
   * statutory floor is the longest in the nation and exceeds the HIPAA
   * §164.530(j)(2) 6-year floor, so it is the conservative default that keeps
   * every state compliant.
   */
  retentionYears?: number
  /** Rows per chunk. Default 1000. */
  chunkSize?: number
  /** Hard upper limit on rows moved in a single run. Default 100_000. */
  maxRowsPerRun?: number
  /** Override "now" for deterministic tests. */
  now?: Date
}

export interface AuditRetentionSweepResult {
  runId: string
  rowsArchived: number
  rowsPurgedFromHot: number
  cutoffUsed: Date
  durationMs: number
}

const DEFAULTS: Required<Omit<AuditRetentionSweepOptions, 'now'>> & { now?: Date } = {
  retentionYears: PA_RETENTION_YEARS,
  chunkSize: 1000,
  maxRowsPerRun: 100_000,
  now: undefined,
}

export async function runAuditRetentionSweep(
  db: Knex,
  options: AuditRetentionSweepOptions = {},
): Promise<AuditRetentionSweepResult> {
  const opts = { ...DEFAULTS, ...options }
  const now = opts.now ?? new Date()
  const cutoff = new Date(now)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - opts.retentionYears)

  const startedAt = new Date()

  // Open the run record up-front so we can log a failure even if the
  // transaction below explodes.
  const [{ id: runId }] = await db('audit_retention_runs')
    .insert({
      started_at: startedAt,
      status: 'running',
      cutoff_used: cutoff,
    })
    .returning('id')

  let totalArchived = 0
  let totalPurged = 0

  try {
    while (totalArchived < opts.maxRowsPerRun) {
      const limit = Math.min(opts.chunkSize, opts.maxRowsPerRun - totalArchived)
      const chunkResult = await processOneChunk(db, cutoff, limit)
      if (chunkResult.archived === 0) break
      totalArchived += chunkResult.archived
      totalPurged += chunkResult.purged
    }

    const completedAt = new Date()
    await db('audit_retention_runs').where({ id: runId }).update({
      status: 'success',
      completed_at: completedAt,
      rows_archived: totalArchived,
      rows_purged_from_hot: totalPurged,
    })

    return {
      runId,
      rowsArchived: totalArchived,
      rowsPurgedFromHot: totalPurged,
      cutoffUsed: cutoff,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    await db('audit_retention_runs').where({ id: runId }).update({
      status: 'error',
      completed_at: new Date(),
      rows_archived: totalArchived,
      rows_purged_from_hot: totalPurged,
      error_message: message,
    })
    throw error
  }
}

interface ChunkResult {
  archived: number
  purged: number
}

/**
 * Process one chunk inside a single transaction. The append-only trigger on
 * `audit_events` is temporarily disabled inside this transaction's scope
 * so we can DELETE rows — without ever permitting application code to do so.
 *
 * Postgres `SET LOCAL session_replication_role = replica` is scoped to the
 * transaction and reverts on commit/rollback. It is the standard pattern for
 * "system-level row maintenance that bypasses normal triggers."
 */
async function processOneChunk(db: Knex, cutoff: Date, limit: number): Promise<ChunkResult> {
  return db.transaction(async (trx) => {
    await trx.raw("SET LOCAL session_replication_role = 'replica'")

    // Lock the candidate rows so a concurrent sweep can't double-archive.
    const candidates = (await trx('audit_events')
      .where('occurred_at', '<', cutoff)
      .orderBy('occurred_at', 'asc')
      .limit(limit)
      .forUpdate()
      .select('id')) as Array<{ id: string }>

    if (candidates.length === 0) {
      return { archived: 0, purged: 0 }
    }

    const ids = candidates.map((r) => r.id)

    // Insert into archive, preserving original id and timestamps.
    // ON CONFLICT DO NOTHING means a partially-completed previous run
    // (e.g., archived rows but failed to delete from hot) is safely re-runnable.
    // Column list mirrors the LIVE audit_events shape (actor_id/actor_type/
    // entity_type/entity_id/outcome/correlation_id). The previous version
    // referenced legacy columns (actor_user_id/actor_caregiver_id/resource_type/
    // resource_id/user_agent/ip_address) that do not exist on audit_events, so
    // this INSERT...SELECT threw "column does not exist" on the first non-empty
    // run. See schema.ts R16 for the archive table definition.
    const archived = await trx.raw(
      `
      INSERT INTO audit_events_archive (
        id, agency_id, actor_id, actor_type,
        event_type, entity_type, entity_id, outcome,
        correlation_id, payload, occurred_at
      )
      SELECT
        id, agency_id, actor_id, actor_type,
        event_type, entity_type, entity_id, outcome,
        correlation_id, payload, occurred_at
      FROM audit_events
      WHERE id = ANY(?::uuid[])
      ON CONFLICT (id) DO NOTHING
      `,
      [ids],
    )

    // Now purge from hot.
    const purged = await trx('audit_events').whereIn('id', ids).del()

    return {
      // archived.rowCount is the most reliable count across pg drivers
      archived: typeof archived?.rowCount === 'number' ? archived.rowCount : ids.length,
      purged,
    }
  })
}
