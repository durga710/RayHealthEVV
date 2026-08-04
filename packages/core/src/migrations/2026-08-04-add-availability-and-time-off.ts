/**
 * Migration: caregiver availability and time-off requests.
 *
 * Two tables, deliberately separate because they mean different things to a
 * scheduler:
 *
 *   caregiver_availability , the weekly hours a caregiver says they can
 *     normally work. A PREFERENCE. Booking outside it is allowed and produces
 *     a warning, because real agencies cover shifts outside someone's usual
 *     window all the time and a hard block would just get worked around.
 *
 *   time_off_requests , specific dates a caregiver has asked not to work, and
 *     the agency's answer. An APPROVED request is a COMMITMENT: scheduling
 *     over it is a hard conflict, because approving time off and then booking
 *     the shift anyway is how an agency loses staff.
 *
 * Shape notes:
 *   - Availability stores day_of_week 0..6 (Sunday..Saturday) plus HH:MM
 *     strings, matching how assignments already carry start_time/end_time.
 *   - Time off is whole days (start_date..end_date inclusive). Partial-day
 *     leave is not modeled; an agency that needs it can approve a day and
 *     schedule around it, which is honest, rather than have a half-supported
 *     hours field that scheduling ignores.
 *   - `reason` and `review_note` are free text and may name a medical or
 *     family situation, so both are treated as sensitive: agency-scoped reads
 *     only, never in a notification body or audit payload.
 *
 * Idempotent via hasTable guards, safe to re-run. Callbacks are synchronous on
 * purpose: an async callback is silently dropped by knex.
 */

import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('caregiver_availability'))) {
    await knex.schema.createTable('caregiver_availability', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('agency_id').references('id').inTable('agencies').notNullable().onDelete('CASCADE')
      table
        .uuid('caregiver_id')
        .references('id')
        .inTable('caregivers')
        .notNullable()
        .onDelete('CASCADE')
      // 0 = Sunday .. 6 = Saturday, matching JavaScript's getDay().
      table.integer('day_of_week').notNullable()
      table.string('start_time', 5).notNullable()
      table.string('end_time', 5).notNullable()
      table.timestamps(true, true)
      table.index(['agency_id'])
      table.index(['caregiver_id'])
    })
  }

  if (!(await knex.schema.hasTable('time_off_requests'))) {
    await knex.schema.createTable('time_off_requests', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('agency_id').references('id').inTable('agencies').notNullable().onDelete('CASCADE')
      table
        .uuid('caregiver_id')
        .references('id')
        .inTable('caregivers')
        .notNullable()
        .onDelete('CASCADE')
      table.date('start_date').notNullable()
      table.date('end_date').notNullable()
      table.string('reason', 500).nullable()
      // requested | approved | denied | cancelled
      table.string('status', 16).notNullable().defaultTo('requested')
      table.uuid('reviewed_by').nullable()
      table.timestamp('reviewed_at', { useTz: true }).nullable()
      table.string('review_note', 500).nullable()
      table.timestamps(true, true)
      table.index(['agency_id', 'status'])
      table.index(['caregiver_id', 'start_date'])
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('time_off_requests')
  await knex.schema.dropTableIfExists('caregiver_availability')
}
