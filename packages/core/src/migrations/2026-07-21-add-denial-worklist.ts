/**
 * Migration: denial worklist state on remittance postings.
 *
 * Adds four nullable columns to `claim_remittances` so a denied posting can
 * be worked to resolution without a separate table:
 *   - denial_status      varchar(16)  worklist state; NULL means "not yet
 *                                     touched" and the API presents it as
 *                                     'new' (no backfill needed)
 *   - denial_note        text         free-text working note
 *   - denial_updated_at  timestamptz  last worklist touch
 *   - denial_updated_by  uuid         user who touched it (no FK: users may
 *                                     be deleted; the audit trail has the
 *                                     authoritative actor record)
 *
 * The ledger rows themselves stay append-only in spirit: posting fields are
 * never rewritten, only this worklist state mutates. Idempotent via
 * hasColumn guards, safe to re-run.
 */

import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('claim_remittances'))) return
  if (!(await knex.schema.hasColumn('claim_remittances', 'denial_status'))) {
    await knex.schema.alterTable('claim_remittances', (table) => {
      table.string('denial_status', 16)
    })
  }
  if (!(await knex.schema.hasColumn('claim_remittances', 'denial_note'))) {
    await knex.schema.alterTable('claim_remittances', (table) => {
      table.text('denial_note')
    })
  }
  if (!(await knex.schema.hasColumn('claim_remittances', 'denial_updated_at'))) {
    await knex.schema.alterTable('claim_remittances', (table) => {
      table.timestamp('denial_updated_at', { useTz: true })
    })
  }
  if (!(await knex.schema.hasColumn('claim_remittances', 'denial_updated_by'))) {
    await knex.schema.alterTable('claim_remittances', (table) => {
      table.uuid('denial_updated_by')
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('claim_remittances'))) return
  for (const col of ['denial_updated_by', 'denial_updated_at', 'denial_note', 'denial_status']) {
    if (await knex.schema.hasColumn('claim_remittances', col)) {
      await knex.schema.alterTable('claim_remittances', (table) => {
        table.dropColumn(col)
      })
    }
  }
}
