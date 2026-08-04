/**
 * Migration: caregiver mileage entries.
 *
 * Home-care caregivers drive between clients all day and are commonly
 * reimbursed for it. Until now there was nowhere to record that, so agencies
 * were collecting it on paper or not at all.
 *
 * Shape notes:
 *   - `miles_hundredths` is an integer: 12.34 miles stores as 1234. Same
 *     reason money is stored in cents, a float odometer difference summed
 *     over a month drifts.
 *   - `visit_id` is nullable. Not every trip attaches to a visit (a supply
 *     run, a drive to the office), and a visit-linked trip should survive the
 *     visit being reviewed, so there is no cascade from it.
 *   - `status` is the approval workflow: submitted, approved, rejected. An
 *     agency pays on approved rows; the caregiver sees the state of each.
 *   - `purpose` is free text and IS potentially PHI, because a caregiver may
 *     type a client's name into it. It is treated as PHI everywhere it is
 *     read: agency-scoped queries only, never in a notification body, never
 *     in an audit payload.
 *
 * Idempotent via hasTable guards, safe to re-run. Callbacks are synchronous
 * on purpose: an async callback is silently dropped by knex.
 */

import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('mileage_entries'))) {
    await knex.schema.createTable('mileage_entries', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('agency_id').references('id').inTable('agencies').notNullable().onDelete('CASCADE')
      table.uuid('caregiver_id').references('id').inTable('caregivers').notNullable().onDelete('CASCADE')
      // Optional visit linkage. No FK cascade: a trip that happened still
      // happened even if the visit row is later removed.
      table.uuid('visit_id').nullable()
      table.date('trip_date').notNullable()
      // Miles to two decimal places, stored as hundredths.
      table.integer('miles_hundredths').notNullable()
      table.string('purpose', 500).nullable()
      table.string('status', 16).notNullable().defaultTo('submitted')
      table.uuid('reviewed_by').nullable()
      table.timestamp('reviewed_at', { useTz: true }).nullable()
      table.string('review_note', 500).nullable()
      table.timestamps(true, true)
      table.index(['agency_id', 'trip_date'])
      table.index(['caregiver_id', 'trip_date'])
      table.index(['status'])
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('mileage_entries')
}
