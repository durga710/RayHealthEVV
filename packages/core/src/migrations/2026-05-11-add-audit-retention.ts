/**
 * Migration: add audit retention infrastructure.
 *
 * Adds:
 *   - audit_events_archive table — cold-storage destination for events older
 *     than the retention floor (6 years per docs/compliance/hipaa/DATA_RETENTION.md).
 *   - audit_retention_runs table — execution log for each sweep, so we can
 *     prove to an auditor that the retention job is actually running.
 *
 * Does NOT modify the existing audit_events append-only trigger. The sweep
 * worker temporarily disables the trigger inside a transaction, moves rows,
 * and re-enables the trigger. See worker code for the safe pattern.
 *
 * Idempotent.
 */

import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('audit_events_archive'))) {
    await knex.schema.createTable('audit_events_archive', (table) => {
      // Mirror of audit_events shape. Keep id stable across the move so any
      // future restore can re-insert by id without conflict.
      table.uuid('id').primary()
      table.uuid('agency_id').notNullable()
      table.uuid('actor_user_id')
      table.uuid('actor_caregiver_id')
      table.string('event_type').notNullable()
      table.string('resource_type')
      table.uuid('resource_id')
      table.jsonb('payload').notNullable().defaultTo(knex.raw("'{}'::jsonb"))
      table.text('user_agent')
      table.string('ip_address', 64)
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
