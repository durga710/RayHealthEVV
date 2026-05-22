/**
 * Migration: add access_code + token + accepted_at + last_sent_at to staff_invites.
 *
 * Supports the access-code onboarding flow committed to in the brand memory:
 *   - access_code: short alphanumeric the admin shares verbally / via SMS as
 *     a second factor (the link alone is not enough — caregiver must enter it)
 *   - token: long URL-safe random string, lives in the magic link
 *   - accepted_at: tracks when the invitee completed signup
 *   - last_sent_at: when the most recent email went out (for resend cadence)
 *
 * Idempotent.
 */
import type { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=2026-05-11-add-invite-access-code.d.ts.map