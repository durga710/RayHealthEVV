/**
 * Migration: add agency_hhaexchange_config table.
 *
 * Parallel to `agency_sandata_config`. Stores per-agency HHAeXchange identity
 * and mapping data. Required for NJ (sole HHAeXchange state) and any PA
 * agency that picks HHAeXchange via the EVV aggregator picker.
 *
 * Key fields:
 *   - agency_tax_id  — 9-digit EIN registered with HHAeXchange (text to
 *                      preserve leading zeros; pattern enforced in Zod).
 *   - hha_provider_id — HHAeXchange's per-agency provider identifier.
 *   - timezone       — drives ServiceStart / ServiceEnd formatting.
 *   - caregiver_mappings — JSONB array of {caregiverId, employeeId}.
 *   - service_mappings   — JSONB array of {internalServiceCode, hhaServiceCode, label}.
 *   - enabled        — gates whether the export pipeline actually emits to HHAeXchange.
 *
 * Idempotent: uses `hasTable` guard. Safe to re-run.
 */

import type { Knex } from 'knex'

const TABLE = 'agency_hhaexchange_config'

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(TABLE)) return

  await knex.schema.createTable(TABLE, (table) => {
    table.uuid('agency_id').primary().references('id').inTable('agencies').onDelete('CASCADE')
    // 9-digit EIN, no dash — stored as text to preserve leading zeros and to
    // allow staged onboarding (NULL until issued).
    table.string('agency_tax_id', 9).nullable()
    table.string('hha_provider_id', 32).nullable()
    table.string('timezone', 64).notNullable().defaultTo('America/New_York')
    table.jsonb('caregiver_mappings').notNullable().defaultTo(knex.raw("'[]'::jsonb"))
    table.jsonb('service_mappings').notNullable().defaultTo(knex.raw("'[]'::jsonb"))
    table.boolean('enabled').notNullable().defaultTo(false)
    table.timestamps(true, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE)
}
