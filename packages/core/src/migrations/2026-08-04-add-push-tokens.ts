/**
 * Migration: device push tokens.
 *
 * Until now every notification was a local schedule set by the device itself,
 * so the server could not tell a caregiver anything it learned after they
 * closed the app (a shift reassigned, a visit rejected by the aggregator, a
 * message from the office).
 *
 * Shape notes:
 *   - The row is keyed on (token, agency_id), NOT on token alone. One mobile
 *     identity can work at several agencies, and the sending side resolves
 *     recipients through that agency's own caregivers. Scoping the row the
 *     same way means agency A's send can never reach through to a row that
 *     belongs to agency B, which keeps the standing rule that an agency must
 *     never be able to observe that a caregiver also works elsewhere.
 *   - `disabled_at` is set when the push service reports the token is dead
 *     (app uninstalled, notifications turned off). Rows are retired rather
 *     than deleted so a redelivery attempt does not resurrect them.
 *   - No PHI here: a token, a platform string, and timestamps.
 *
 * Idempotent via hasTable / hasColumn guards, safe to re-run. The alterTable
 * and createTable callbacks are synchronous on purpose: an async callback is
 * silently dropped by knex and the column never lands.
 */

import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('push_tokens'))) {
    await knex.schema.createTable('push_tokens', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('agency_id').references('id').inTable('agencies').notNullable().onDelete('CASCADE')
      table.uuid('user_id').references('id').inTable('users').notNullable().onDelete('CASCADE')
      // Null for non-caregiver staff; the caregiver linkage is what agency-side
      // sends resolve against.
      table.uuid('caregiver_id').nullable()
      // Expo push token, e.g. ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx].
      table.string('token', 255).notNullable()
      table.string('platform', 16).notNullable().defaultTo('unknown')
      table.timestamp('last_seen_at', { useTz: true })
      table.timestamp('disabled_at', { useTz: true })
      table.string('disabled_reason', 64)
      table.timestamps(true, true)
      table.unique(['token', 'agency_id'])
      table.index(['agency_id'])
      table.index(['user_id'])
      table.index(['caregiver_id'])
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('push_tokens')
}
