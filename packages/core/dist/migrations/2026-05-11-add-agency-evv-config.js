/**
 * Migration: add agency_evv_config table.
 *
 * One row per agency. Records which EVV aggregator the agency uses (sandata
 * vs hhaexchange) when the state allows a choice. For states that force one
 * aggregator (e.g. NJ → HHAeXchange) this row is informational; the state
 * registry's `aggregatorChoice` flag is the source of truth.
 *
 * Sized intentionally narrow: per-aggregator mappings (Provider ID, caregiver
 * IDs, service codes) live in `agency_sandata_config` and (future)
 * `agency_hhaexchange_config`. This table only holds the choice + the
 * production-ready flag the operator flips when go-live is approved.
 *
 * Idempotent: uses `hasTable` guard. Safe to re-run.
 */
const TABLE = 'agency_evv_config';
export async function up(knex) {
    if (await knex.schema.hasTable(TABLE))
        return;
    await knex.schema.createTable(TABLE, (table) => {
        table.uuid('agency_id').primary().references('id').inTable('agencies').onDelete('CASCADE');
        // 'sandata' | 'hhaexchange' | 'none' — kept as text rather than an
        // enum so future aggregators (state-run portals etc.) can be added
        // without a migration.
        table.string('aggregator', 16).notNullable().defaultTo('none');
        // The agency's billing state. Stored alongside aggregator so the
        // resolver can pick state-default behaviour without joining `agencies`.
        table.string('state_code', 2).notNullable();
        // Flipped by an admin once Provider ID, mappings, and BAA are all
        // signed. Until then exports stay in dry-run.
        table.boolean('production_ready').notNullable().defaultTo(false);
        table.timestamps(true, true);
    });
}
export async function down(knex) {
    await knex.schema.dropTableIfExists(TABLE);
}
//# sourceMappingURL=2026-05-11-add-agency-evv-config.js.map