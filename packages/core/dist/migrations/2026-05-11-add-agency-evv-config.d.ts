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
import type { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=2026-05-11-add-agency-evv-config.d.ts.map