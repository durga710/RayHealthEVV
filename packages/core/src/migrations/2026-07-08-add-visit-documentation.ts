/**
 * Migration: service documentation on EVV visits.
 *
 * Adds two nullable columns to `evv_visits`:
 *   - tasks       jsonb  array of {id, duty} snapshotted from the PA task
 *                        catalog at clock-out (self-contained for audit)
 *   - visit_note  text   free-text caregiver note captured at clock-out
 *
 * Both are nullable: visits recorded before this feature, and visits where
 * the caregiver skipped documentation, simply carry NULL. Idempotent via
 * hasColumn guards, safe to re-run.
 */

import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('evv_visits'))) return
  if (!(await knex.schema.hasColumn('evv_visits', 'tasks'))) {
    await knex.schema.alterTable('evv_visits', (table) => {
      table.jsonb('tasks')
    })
  }
  if (!(await knex.schema.hasColumn('evv_visits', 'visit_note'))) {
    await knex.schema.alterTable('evv_visits', (table) => {
      table.text('visit_note')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('evv_visits'))) return
  if (await knex.schema.hasColumn('evv_visits', 'visit_note')) {
    await knex.schema.alterTable('evv_visits', (table) => {
      table.dropColumn('visit_note')
    })
  }
  if (await knex.schema.hasColumn('evv_visits', 'tasks')) {
    await knex.schema.alterTable('evv_visits', (table) => {
      table.dropColumn('tasks')
    })
  }
}
