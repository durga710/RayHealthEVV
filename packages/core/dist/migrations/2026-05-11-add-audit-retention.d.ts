/**
 * Migration: add audit retention infrastructure.
 *
 * Adds:
 *   - audit_events_archive table — cold-storage destination for events older
 *     than the retention floor (6 years per docs/compliance/hipaa/DATA_RETENTION.md).
 *   - audit_retention_runs table — execution log for each sweep, so we can
 *     prove to an auditor that the retention job is actually running.
 *
 * Does NOT modify the existing audit_events append-only trigger. The sweep
 * worker temporarily disables the trigger inside a transaction, moves rows,
 * and re-enables the trigger. See worker code for the safe pattern.
 *
 * Idempotent.
 */
import type { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=2026-05-11-add-audit-retention.d.ts.map