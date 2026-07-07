/**
 * Migration: enforce at most one OPEN visit per assignment at the DB level.
 *
 * The clock-in route guards against a second concurrent open visit, but a
 * partial unique index is the durable backstop against a race/replay that
 * slips past the application check. Indexes `evv_visits(assignment_id)` only
 * for rows where `clock_out_time IS NULL`, so completed visits are unaffected
 * and an assignment can accumulate any number of finished visits over time.
 *
 * Best-effort: if legacy data already contains duplicate open visits the
 * unique index cannot be created. Rather than fail the whole migration run,
 * we log and continue — the application-level guard still prevents new
 * duplicates, and the data can be reconciled before re-running.
 */
import type { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=2026-07-06-add-open-visit-unique-index.d.ts.map