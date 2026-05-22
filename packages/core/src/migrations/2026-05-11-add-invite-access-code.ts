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

import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasAccessCode = await knex.schema.hasColumn('staff_invites', 'access_code')
  const hasToken = await knex.schema.hasColumn('staff_invites', 'token')
  const hasAcceptedAt = await knex.schema.hasColumn('staff_invites', 'accepted_at')
  const hasLastSentAt = await knex.schema.hasColumn('staff_invites', 'last_sent_at')
  const hasFirstName = await knex.schema.hasColumn('staff_invites', 'first_name')
  const hasLastName = await knex.schema.hasColumn('staff_invites', 'last_name')

  await knex.schema.alterTable('staff_invites', (table) => {
    if (!hasAccessCode) table.string('access_code', 16)
    if (!hasToken) table.string('token', 64).unique()
    if (!hasAcceptedAt) table.timestamp('accepted_at')
    if (!hasLastSentAt) table.timestamp('last_sent_at')
    if (!hasFirstName) table.string('first_name')
    if (!hasLastName) table.string('last_name')
  })

  // Add an index on token for fast accept-flow lookups.
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_staff_invites_token ON staff_invites (token)')
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_staff_invites_token')
  await knex.schema.alterTable('staff_invites', (table) => {
    table.dropColumn('access_code')
    table.dropColumn('token')
    table.dropColumn('accepted_at')
    table.dropColumn('last_sent_at')
    table.dropColumn('first_name')
    table.dropColumn('last_name')
  })
}
