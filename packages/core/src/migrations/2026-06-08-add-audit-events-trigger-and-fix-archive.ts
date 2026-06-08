/**
 * Migration: install the append-only trigger on audit_events and bring the
 * audit_events_archive shape into alignment with the live audit_events shape.
 *
 * Two related issues this fixes:
 *
 *   1. The append-only invariant on `audit_events` was previously documented
 *      and asserted by the retention sweep ("temporarily disables the
 *      trigger inside a transaction") but the trigger itself was never
 *      installed. Until now nothing in Postgres or application code blocked
 *      UPDATE or DELETE against audit_events outside the sweep. This
 *      migration installs `audit_events_block_mutation_trg`.
 *
 *   2. The audit_events_archive shape was modelled against an earlier
 *      audit_events schema that used `actor_user_id`, `actor_caregiver_id`,
 *      `resource_type`, `resource_id`, `user_agent`, `ip_address`. The live
 *      `audit_events` table uses `actor_id`, `actor_type`, `entity_type`,
 *      `entity_id`, `outcome`, `correlation_id` (see schema.ts:171-189).
 *      The retention sweep's INSERT...SELECT therefore referenced columns
 *      that did not exist on `audit_events` and would have failed on the
 *      first non-empty run.
 *
 * The trigger is a default-mode trigger (not ENABLE ALWAYS), which means it
 * respects `SET LOCAL session_replication_role = 'replica'`. This is the
 * exact bypass pattern used by audit-retention-sweep.ts and by test setup
 * helpers, so this migration is compatible with the existing sweep design.
 *
 * Idempotent.
 */

import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  // 1. Trigger function + trigger on audit_events.
  await knex.raw(`
    create or replace function audit_events_block_mutation_fn()
    returns trigger as $$
    begin
      raise exception 'audit_events is append-only; UPDATE/DELETE blocked. Use the retention sweep with SET LOCAL session_replication_role = ''replica'' inside a transaction.';
    end;
    $$ language plpgsql;
  `)

  await knex.raw('drop trigger if exists audit_events_block_mutation_trg on audit_events')
  await knex.raw(`
    create trigger audit_events_block_mutation_trg
    before update or delete on audit_events
    for each row
    execute function audit_events_block_mutation_fn();
  `)

  // 2. Add the columns archive needs to mirror live audit_events.
  // Old columns (actor_user_id, actor_caregiver_id, resource_type, resource_id,
  // user_agent, ip_address) are left in place but unused — they are already
  // nullable, so leaving them does not affect new INSERTs. Dropping them is a
  // separate decision (any operator who already populated them in a side
  // channel would lose that data on a drop).
  if (await knex.schema.hasTable('audit_events_archive')) {
    if (!(await knex.schema.hasColumn('audit_events_archive', 'actor_id'))) {
      await knex.schema.alterTable('audit_events_archive', (table) => {
        table.uuid('actor_id')
      })
    }
    if (!(await knex.schema.hasColumn('audit_events_archive', 'actor_type'))) {
      await knex.schema.alterTable('audit_events_archive', (table) => {
        table.string('actor_type')
      })
    }
    if (!(await knex.schema.hasColumn('audit_events_archive', 'entity_type'))) {
      await knex.schema.alterTable('audit_events_archive', (table) => {
        table.string('entity_type')
      })
    }
    if (!(await knex.schema.hasColumn('audit_events_archive', 'entity_id'))) {
      await knex.schema.alterTable('audit_events_archive', (table) => {
        table.uuid('entity_id')
      })
    }
    if (!(await knex.schema.hasColumn('audit_events_archive', 'outcome'))) {
      await knex.schema.alterTable('audit_events_archive', (table) => {
        table.string('outcome')
      })
    }
    if (!(await knex.schema.hasColumn('audit_events_archive', 'correlation_id'))) {
      await knex.schema.alterTable('audit_events_archive', (table) => {
        table.string('correlation_id')
      })
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('drop trigger if exists audit_events_block_mutation_trg on audit_events')
  await knex.raw('drop function if exists audit_events_block_mutation_fn()')

  if (await knex.schema.hasTable('audit_events_archive')) {
    await knex.schema.alterTable('audit_events_archive', (table) => {
      table.dropColumn('actor_id')
      table.dropColumn('actor_type')
      table.dropColumn('entity_type')
      table.dropColumn('entity_id')
      table.dropColumn('outcome')
      table.dropColumn('correlation_id')
    })
  }
}
