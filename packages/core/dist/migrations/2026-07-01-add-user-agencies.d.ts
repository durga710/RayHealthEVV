/**
 * Migration: user_agencies membership table for multi-agency caregivers.
 *
 * A caregiver can be contracted at more than one agency while signing in with
 * a single mobile identity. `users` keeps its single `agency_id` as the home
 * (default) agency for backward compatibility; `user_agencies` records every
 * agency the user may act in, with the per-agency role and caregiver link the
 * JWT needs when the user switches context.
 *
 * Backfill inserts one membership per existing user from users.agency_id /
 * users.role / users.caregiver_id, guarded by NOT EXISTS — idempotent, safe
 * to re-run.
 */
import type { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=2026-07-01-add-user-agencies.d.ts.map