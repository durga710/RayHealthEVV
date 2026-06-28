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

import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('audit_events_archive'))) {
    await knex.schema.createTable('audit_events_archive', (table) => {
      // Mirror of the LIVE audit_events shape. Keep id stable across the move
      // so any future restore can re-insert by id without conflict.
      table.uuid('id').primary()
      table.uuid('agency_id').notNullable()
      table.uuid('actor_id').notNullable()
      table.string('actor_type').notNullable().defaultTo('user')
      table.string('event_type').notNullable()
      table.string('entity_type').notNullable()
      table.uuid('entity_id').notNullable()
      table.string('outcome').notNullable().defaultTo('success')
      table.string('correlation_id')
      table.jsonb('payload').notNullable().defaultTo(knex.raw("'{}'::jsonb"))
      table.timestamp('occurred_at').notNullable()
      table.timestamp('archived_at').notNullable().defaultTo(knex.fn.now())
      table.index(['agency_id', 'occurred_at'])
      table.index(['event_type'])
    })
  }

  if (!(await knex.schema.hasTable('audit_retention_runs'))) {
    await knex.schema.createTable('audit_retention_runs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.timestamp('started_at').notNullable()
      table.timestamp('completed_at')
      table.string('status').notNullable() // running | success | error
      table.integer('rows_archived').notNullable().defaultTo(0)
      table.integer('rows_purged_from_hot').notNullable().defaultTo(0)
      table.timestamp('cutoff_used').notNullable()
      table.text('error_message')
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      table.index(['started_at'])
      table.index(['status'])
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_retention_runs')
  await knex.schema.dropTableIfExists('audit_events_archive')
}
