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
import type { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(): Promise<void>;
//# sourceMappingURL=2026-06-30-backfill-visit-maintenance-agency-id.d.ts.map