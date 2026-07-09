/**
 * Migration: verification-of-service e-signature on EVV visits.
 *
 * Adds a nullable `signature` jsonb column to `evv_visits` holding the
 * stroke-vector signature captured at clock-out ({strokes, width, height,
 * signerRole, signerName, signedAt}). Nullable: visits recorded before this
 * feature, and visits where the client couldn't or chose not to sign, carry
 * NULL. Idempotent via hasColumn guard, safe to re-run.
 */

import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('evv_visits'))) return
  if (!(await knex.schema.hasColumn('evv_visits', 'signature'))) {
    await knex.schema.alterTable('evv_visits', (table) => {
      table.jsonb('signature')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('evv_visits'))) return
  if (await knex.schema.hasColumn('evv_visits', 'signature')) {
    await knex.schema.alterTable('evv_visits', (table) => {
      table.dropColumn('signature')
    })
  }
}
