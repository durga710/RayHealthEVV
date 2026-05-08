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

  if (!(await knex.schema.hasTable('sessions'))) {
    await knex.schema.createTable('sessions', (table) => {
      table.uuid('id').primary();
      table.uuid('agency_id').references('id').inTable('agencies').notNullable();
      table.uuid('user_id').references('id').inTable('users').notNullable();
      table.string('role').notNullable();
      table.uuid('caregiver_id');
      table.string('session_token_hash', 64).notNullable().unique();
      table.string('csrf_token_hash', 64).notNullable();
      table.text('user_agent');
      table.string('ip_address', 64);
      table.timestamp('expires_at').notNullable();
      table.timestamp('revoked_at');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.index(['agency_id', 'user_id']);
      table.index(['expires_at']);
    });
  }

  if (!(await knex.schema.hasTable('visit_maintenance'))) {
    await knex.schema.createTable('visit_maintenance', (table) => {
      table.uuid('id').primary();
      table.uuid('visit_id').references('id').inTable('evv_visits').notNullable();
      table.uuid('requester_id').notNullable();
      table.text('reason').notNullable();
      table.timestamp('original_start_time');
      table.timestamp('original_end_time');
      table.timestamp('adjusted_start_time');
      table.timestamp('adjusted_end_time');
      table.string('status').notNullable().defaultTo('pending');
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('caregivers'))) {
    await knex.schema.createTable('caregivers', (table) => {
      table.uuid('id').primary();
      table.uuid('agency_id').references('id').inTable('agencies').notNullable();
      table.string('first_name').notNullable();
      table.string('last_name').notNullable();
      table.string('email').notNullable().unique();
      table.string('phone');
      table.string('npi', 10);
      table.date('hire_date');
      table.string('status').notNullable().defaultTo('active');
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('caregiver_credentials'))) {
    await knex.schema.createTable('caregiver_credentials', (table) => {
      table.uuid('id').primary();
      table.uuid('caregiver_id').references('id').inTable('caregivers').notNullable();
      table.string('credential_type').notNullable();
      table.string('status').notNullable().defaultTo('pending');
      table.date('expires_at').notNullable();
      table.date('issued_at').nullable();
      table.text('notes').nullable();
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('staff_invites'))) {
    await knex.schema.createTable('staff_invites', (table) => {
      table.uuid('id').primary();
      table.uuid('agency_id').references('id').inTable('agencies').notNullable();
      table.string('email').notNullable();
      table.string('role').notNullable();
      table.string('status').notNullable().defaultTo('pending');
      table.uuid('invited_by').references('id').inTable('users').notNullable();
      table.timestamp('expires_at').notNullable();
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('evv_exceptions'))) {
    await knex.schema.createTable('evv_exceptions', (table) => {
      table.uuid('id').primary();
      table.uuid('visit_id').references('id').inTable('evv_visits').notNullable();
      table.string('exception_type').notNullable();
      table.text('reason').notNullable();
      table.uuid('approved_by').nullable();
      table.timestamp('approved_at').nullable();
      table.timestamps(true, true);
    });
  }

  if (!(await knex.schema.hasTable('audit_events'))) {
    await knex.schema.createTable('audit_events', (table) => {
      table.uuid('id').primary();
      table.uuid('agency_id').references('id').inTable('agencies').notNullable();
      table.uuid('actor_id').notNullable();
      table.string('actor_type').notNullable().defaultTo('user');
      table.string('event_type').notNullable();
      table.string('entity_type').notNullable();
      table.uuid('entity_id').notNullable();
      table.string('outcome').notNullable().defaultTo('success');
      table.string('correlation_id');
      table.jsonb('payload').notNullable().defaultTo('{}');
      table.timestamp('occurred_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.index(['agency_id', 'event_type']);
      table.index(['entity_type', 'entity_id']);
      table.index(['occurred_at']);
    });
  }

  if (await knex.schema.hasTable('audit_events')) {
    if (!(await knex.schema.hasColumn('audit_events', 'actor_type'))) {
      await knex.schema.alterTable('audit_events', (table) => {
        table.string('actor_type').notNullable().defaultTo('user');
      });
    }
    if (!(await knex.schema.hasColumn('audit_events', 'outcome'))) {
      await knex.schema.alterTable('audit_events', (table) => {
        table.string('outcome').notNullable().defaultTo('success');
      });
    }
    if (!(await knex.schema.hasColumn('audit_events', 'correlation_id'))) {
      await knex.schema.alterTable('audit_events', (table) => {
        table.string('correlation_id');
      });
    }
    if (!(await knex.schema.hasColumn('audit_events', 'occurred_at'))) {
      await knex.schema.alterTable('audit_events', (table) => {
        table.timestamp('occurred_at').notNullable().defaultTo(knex.fn.now());
      });
    }
    await knex.raw('create index if not exists audit_events_agency_event_idx on audit_events (agency_id, event_type)');
    await knex.raw('create index if not exists audit_events_entity_idx on audit_events (entity_type, entity_id)');
    await knex.raw('create index if not exists audit_events_occurred_at_idx on audit_events (occurred_at)');
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_events');
  await knex.schema.dropTableIfExists('evv_exceptions');
  await knex.schema.dropTableIfExists('staff_invites');
  await knex.schema.dropTableIfExists('caregiver_credentials');
  await knex.schema.dropTableIfExists('caregivers');
  await knex.schema.dropTableIfExists('sessions');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('visit_maintenance');
  await knex.schema.dropTableIfExists('evv_visits');
  await knex.schema.dropTableIfExists('assignments');
  await knex.schema.dropTableIfExists('visit_templates');
  await knex.schema.dropTableIfExists('authorizations');
  await knex.schema.dropTableIfExists('clients');
  await knex.schema.dropTableIfExists('agencies');
}
