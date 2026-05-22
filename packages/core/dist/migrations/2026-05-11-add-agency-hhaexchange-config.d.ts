/**
 * Migration: add agency_hhaexchange_config table.
 *
 * Parallel to `agency_sandata_config`. Stores per-agency HHAeXchange identity
 * and mapping data. Required for NJ (sole HHAeXchange state) and any PA
 * agency that picks HHAeXchange via the EVV aggregator picker.
 *
 * Key fields:
 *   - agency_tax_id  — 9-digit EIN registered with HHAeXchange (text to
 *                      preserve leading zeros; pattern enforced in Zod).
 *   - hha_provider_id — HHAeXchange's per-agency provider identifier.
 *   - timezone       — drives ServiceStart / ServiceEnd formatting.
 *   - caregiver_mappings — JSONB array of {caregiverId, employeeId}.
 *   - service_mappings   — JSONB array of {internalServiceCode, hhaServiceCode, label}.
 *   - enabled        — gates whether the export pipeline actually emits to HHAeXchange.
 *
 * Idempotent: uses `hasTable` guard. Safe to re-run.
 */
import type { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=2026-05-11-add-agency-hhaexchange-config.d.ts.map