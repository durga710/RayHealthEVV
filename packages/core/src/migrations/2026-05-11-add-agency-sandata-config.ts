/**
 * Migration: add agency_sandata_config table.
 *
 * One row per agency. Stores the Sandata Provider ID, timezone, enabled flag,
 * and JSON-serialized per-caregiver and per-service mappings. The application
 * layer (`packages/app/src/services/sandata-mapping.ts`) validates these JSON
 * blobs against a Zod schema before use.
 *
 * Idempotent: uses `hasTable` guard. Safe to re-run.
 */

import type { Knex } from 'knex'

const TABLE = 'agency_sandata_config'

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(TABLE)) return

  await knex.schema.createTable(TABLE, (table) => {
    table.uuid('agency_id').primary().references('id').inTable('agencies').onDelete('CASCADE')
    // Sandata Provider ID — 9-digit numeric string, but stored as text to avoid
    // leading-zero loss and to allow staged onboarding (NULL until issued).
    table.string('provider_id', 9).nullable()
    table.string('timezone', 64).notNullable().defaultTo('America/New_York')
    // Stored as JSON for now; could be normalized into child tables if cardinality
    // ever justifies the joins. For the typical agency (≤ 200 caregivers, ≤ 10
    // service codes) JSON is faster and clearer.
    table.jsonb('caregiver_mappings').notNullable().defaultTo(knex.raw("'[]'::jsonb"))
    table.jsonb('service_mappings').notNullable().defaultTo(knex.raw("'[]'::jsonb"))
    table.boolean('enabled').notNullable().defaultTo(false)
    table.timestamps(true, true)
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE)
}
