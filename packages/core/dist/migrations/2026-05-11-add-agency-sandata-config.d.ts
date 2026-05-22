/**
 * Migration: add agency_sandata_config table.
 *
 * One row per agency. Stores the Sandata Provider ID, timezone, enabled flag,
 * and JSON-serialized per-caregiver and per-service mappings. The application
 * layer (`packages/app/src/services/sandata-mapping.ts`) validates these JSON
 * blobs against a Zod schema before use.
 *
 * Idempotent: uses `hasTable` guard. Safe to re-run.
 */
import type { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=2026-05-11-add-agency-sandata-config.d.ts.map