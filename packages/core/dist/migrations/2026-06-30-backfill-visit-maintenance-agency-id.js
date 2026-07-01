/**
 * Migration: backfill visit_maintenance.agency_id for rows written before
 * that column was populated on insert, and enforce it going forward.
 *
 * visit_maintenance.agency_id is a denormalized copy of the owning agency
 * (the authoritative link is visit_id -> evv_visits.caregiver_id ->
 * caregivers.agency_id) used so compliance-engine queue/audit-defense
 * queries don't have to join through that chain on every read. Until this
 * migration, VisitMaintenanceRepository.requestUnlock() never set the
 * column, so every row had agency_id = NULL — `WHERE agency_id = $1` never
 * matches NULL, so those corrections were silently excluded from the PA
 * DHS audit-defense packet.
 *
 * Idempotent: only touches rows where agency_id IS NULL. Safe to re-run.
 */
const TABLE = 'visit_maintenance';
export async function up(knex) {
    if (!(await knex.schema.hasTable(TABLE)))
        return;
    if (!(await knex.schema.hasColumn(TABLE, 'agency_id')))
        return;
    await knex.raw(`
    UPDATE visit_maintenance AS m
    SET agency_id = c.agency_id
    FROM evv_visits AS v
    JOIN caregivers AS c ON c.id = v.caregiver_id
    WHERE m.visit_id = v.id
      AND m.agency_id IS NULL
  `);
}
export async function down() {
    // Backfill is non-destructive and not worth reversing.
}
//# sourceMappingURL=2026-06-30-backfill-visit-maintenance-agency-id.js.map