/**
 * Audit retention sweep.
 *
 * Moves audit_events rows older than the configured retention floor (default
 * 6 years per HIPAA §164.530(j)(2) and docs/compliance/hipaa/DATA_RETENTION.md)
 * from the hot `audit_events` table to the cold `audit_events_archive` table,
 * then deletes them from `audit_events`.
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
import type { Knex } from 'knex';
export interface AuditRetentionSweepOptions {
    /** Retention floor in years. Default 6 per HIPAA. */
    retentionYears?: number;
    /** Rows per chunk. Default 1000. */
    chunkSize?: number;
    /** Hard upper limit on rows moved in a single run. Default 100_000. */
    maxRowsPerRun?: number;
    /** Override "now" for deterministic tests. */
    now?: Date;
}
export interface AuditRetentionSweepResult {
    runId: string;
    rowsArchived: number;
    rowsPurgedFromHot: number;
    cutoffUsed: Date;
    durationMs: number;
}
export declare function runAuditRetentionSweep(db: Knex, options?: AuditRetentionSweepOptions): Promise<AuditRetentionSweepResult>;
//# sourceMappingURL=audit-retention-sweep.d.ts.map