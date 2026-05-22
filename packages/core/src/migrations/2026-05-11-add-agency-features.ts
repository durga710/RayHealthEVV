/**
 * Migration: add features JSONB column to agencies table.
 *
 * Stores per-agency feature flags. Initial flag of interest: ai_copilot.
 * Shape:
 *   { "ai_copilot": { "enabled": false, "plan": "off" | "starter" | "pro" } }
 *
 * Storing as JSONB instead of a normalized table because:
 *   - Flags are sparse and evolve quickly during product iteration
 *   - Reads always join with the agency anyway
 *   - Per-flag indexes can be added later if cardinality justifies them
 *
 * Idempotent.
 */

import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('agencies', 'features')
  if (!hasColumn) {
    await knex.schema.alterTable('agencies', (table) => {
      table.jsonb('features').notNullable().defaultTo(knex.raw("'{}'::jsonb"))
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('agencies', 'features')
  if (hasColumn) {
    await knex.schema.alterTable('agencies', (table) => {
      table.dropColumn('features')
    })
  }
}
