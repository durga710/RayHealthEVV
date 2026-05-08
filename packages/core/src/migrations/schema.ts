import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('agencies'))) {
    await knex.schema.createTable('agencies', (table) => {
      table.uuid('id').primary();
      table.string('name').notNullable();
      table.string('state', 2).notNullable().defaultTo('PA');
      table.jsonb('operating_tracks').notNullable();
      table.string('medicaid_provider_number');
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('clients'))) {
    await knex.schema.createTable('clients', (table) => {
      table.uuid('id').primary();
      table.uuid('agency_id').references('id').inTable('agencies');
      table.string('first_name').notNullable();
      table.string('last_name').notNullable();
      table.date('date_of_birth').notNullable();
      table.string('medicaid_number');
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('authorizations'))) {
    await knex.schema.createTable('authorizations', (table) => {
      table.uuid('id').primary();
      table.uuid('client_id').references('id').inTable('clients').notNullable();
      table.string('payer_id').notNullable();
      table.decimal('units_authorized', 10, 2).notNullable();
      table.string('service_code').notNullable();
      table.date('start_date').notNullable();
      table.date('end_date').notNullable();
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('visit_templates'))) {
    await knex.schema.createTable('visit_templates', (table) => {
      table.uuid('id').primary();
      table.uuid('client_id').references('id').inTable('clients').notNullable();
      table.string('name').notNullable();
      table.jsonb('tasks').notNullable();
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('assignments'))) {
    await knex.schema.createTable('assignments', (table) => {
      table.uuid('id').primary();
      table.uuid('caregiver_id').notNullable(); // In real app, would reference users/staff
      table.uuid('visit_template_id').references('id').inTable('visit_templates').notNullable();
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('evv_visits'))) {
    await knex.schema.createTable('evv_visits', (table) => {
      table.uuid('id').primary();
      table.uuid('assignment_id').references('id').inTable('assignments').notNullable();
      table.uuid('caregiver_id').notNullable();
      table.timestamp('clock_in_time').notNullable();
      table.timestamp('clock_out_time');
      table.jsonb('clock_in_location').notNullable();
      table.jsonb('clock_out_location');
      table.string('status').notNullable().defaultTo('pending');
      table.timestamps(true, true);
    });
  }
  if (!(await knex.schema.hasTable('users'))) {
    await knex.schema.createTable('users', (table) => {
      table.uuid('id').primary();
      table.uuid('agency_id').references('id').inTable('agencies').notNullable();
      table.string('email').notNullable().unique();
      table.string('password_hash').notNullable();
      table.string('role').notNullable();
      table.uuid('caregiver_id');
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('visit_maintenance'))) {
    await knex.schema.createTable('visit_maintenance', (table) => {
      table.uuid('id').primary();
      table.uuid('visit_id').references('id').inTable('evv_visits').notNullable();
      table.uuid('requester_id').notNullable(); // Coordinator/Admin
      table.text('reason').notNullable();
      table.timestamp('original_start_time');
      table.timestamp('original_end_time');
      table.timestamp('adjusted_start_time');
      table.timestamp('adjusted_end_time');
      table.string('status').notNullable().defaultTo('pending');
      table.timestamps(true, true);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('visit_maintenance');
  await knex.schema.dropTableIfExists('evv_visits');
  await knex.schema.dropTableIfExists('assignments');
  await knex.schema.dropTableIfExists('visit_templates');
  await knex.schema.dropTableIfExists('authorizations');
  await knex.schema.dropTableIfExists('clients');
  await knex.schema.dropTableIfExists('agencies');
}
