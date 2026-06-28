/**
 * Migration: add audit retention infrastructure.
 *
 * NOTE: This dated migration is NOT invoked by the baseline runner
 * (`schema.up` in schema.ts — see runner.ts). The OPERATIVE creation of these
 * tables now lives in schema.ts R16, which is what `npm run db:migrate`
 * actually runs. This file is kept for history and is aligned with the live
 * `audit_events` shape (actor_id/actor_type/entity_type/entity_id/outcome/
 * correlation_id) so it cannot reintroduce the legacy-column mismatch.
 *
 * Adds:
 *   - audit_events_archive table — cold-storage destination for events older
 *     than the retention floor (7 years — PA_RETENTION_YEARS).
 *   - audit_retention_runs table — execution log for each sweep, so we can
 *     prove to an auditor that the retention job is actually running.
 *
 * Idempotent.
 */
import type { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=2026-05-11-add-audit-retention.d.ts.map