import type { Knex } from 'knex';

const TABLE = 'visit_task_completions';

export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(TABLE)) return;

  await knex.schema.createTable(TABLE, (table) => {
    table.uuid('id').primary();
    table.uuid('agency_id').notNullable().references('id').inTable('agencies');
    table.uuid('visit_id').notNullable().references('id').inTable('evv_visits');
    table.uuid('caregiver_id').notNullable();
    table.uuid('client_event_id').notNullable().unique();
    table.string('task_code', 3).nullable();
    table.string('task_label', 200).notNullable();
    table.string('status', 20).notNullable();
    table.timestamp('recorded_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);
    table.unique(['visit_id', 'task_label']);
    table.index(['agency_id', 'visit_id']);
    table.index(['caregiver_id', 'recorded_at']);
    table.check(
      "status in ('performed','refused','not_performed')",
      [],
      'visit_task_completions_status_check',
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE);
}
