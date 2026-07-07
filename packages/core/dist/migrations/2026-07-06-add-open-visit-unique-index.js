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
const INDEX = 'evv_visits_one_open_per_assignment';
export async function up(knex) {
    if (!(await knex.schema.hasTable('evv_visits')))
        return;
    try {
        await knex.raw(`CREATE UNIQUE INDEX IF NOT EXISTS ${INDEX} ` +
            `ON evv_visits (assignment_id) WHERE clock_out_time IS NULL`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        process.stderr.write(`Skipping ${INDEX}: ${message} (reconcile duplicate open visits, then re-run)\n`);
    }
}
export async function down(knex) {
    await knex.raw(`DROP INDEX IF EXISTS ${INDEX}`);
}
//# sourceMappingURL=2026-07-06-add-open-visit-unique-index.js.map