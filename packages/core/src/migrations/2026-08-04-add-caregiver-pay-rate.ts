/**
 * Migration: caregiver hourly pay rate.
 *
 * Adds `caregivers.pay_rate_cents`, the hourly rate used to turn verified EVV
 * time into an earnings estimate the caregiver can see in the mobile app.
 *
 * Cents, as an integer, for the same reason every other money column here is:
 * a float rate multiplied by fractional hours accumulates error, and payroll
 * is not a place to discover rounding drift.
 *
 * Nullable with no default. An agency that has not entered rates shows no
 * earnings rather than a confident $0.00, which would read as "you earned
 * nothing" instead of "we do not know your rate".
 *
 * Idempotent via hasColumn guards, safe to re-run. The alterTable callback is
 * synchronous on purpose: an async callback is silently dropped by knex and
 * the column never lands.
 */

import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('caregivers'))) return
  if (!(await knex.schema.hasColumn('caregivers', 'pay_rate_cents'))) {
    await knex.schema.alterTable('caregivers', (table) => {
      table.integer('pay_rate_cents').nullable()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('caregivers'))) return
  if (await knex.schema.hasColumn('caregivers', 'pay_rate_cents')) {
    await knex.schema.alterTable('caregivers', (table) => {
      table.dropColumn('pay_rate_cents')
    })
  }
}
