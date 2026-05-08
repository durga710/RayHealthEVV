export async function up(knex) {
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
            // Cures-Act #1 (service-type) and #2 (beneficiary). Snapshotted onto
            // the visit row at clock-in so the visit stands alone for aggregator
            // submission and claim defense (does not depend on later joins through
            // assignment → visit_template → client / authorization).
            table.string('service_code');
            table.uuid('client_id');
            table.timestamp('clock_in_time').notNullable();
            table.timestamp('clock_out_time');
            table.jsonb('clock_in_location').notNullable();
            table.jsonb('clock_out_location');
            table.string('status').notNullable().defaultTo('pending');
            table.timestamps(true, true);
        });
    }
    else {
        // Backfill the new Cures-Act columns onto an existing evv_visits table.
        if (!(await knex.schema.hasColumn('evv_visits', 'service_code'))) {
            await knex.schema.alterTable('evv_visits', (table) => {
                table.string('service_code');
            });
        }
        if (!(await knex.schema.hasColumn('evv_visits', 'client_id'))) {
            await knex.schema.alterTable('evv_visits', (table) => {
                table.uuid('client_id');
            });
        }
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
    // ── R4 hardening ──────────────────────────────────────────────────────────
    // Convert every `timestamp without time zone` column in the public schema
    // to `timestamptz`. Existing values are reinterpreted as UTC (application
    // emits ISO 8601 via `new Date().toISOString()`, which is UTC). Idempotent:
    // the loop only matches columns that are still timezone-naive.
    await knex.raw(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type = 'timestamp without time zone'
      LOOP
        EXECUTE format(
          'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
          r.table_name, r.column_name, r.column_name
        );
      END LOOP;
    END$$;
  `);
    // sessions.user_id → users.id with ON DELETE CASCADE so a user purge
    // (HIPAA right-to-be-forgotten / staff offboarding) takes active session
    // rows with it instead of leaving orphans that can never be cleaned up.
    // Drop+add is the only portable way to add CASCADE to an existing FK in PG.
    await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='sessions') THEN
        ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_foreign;
        ALTER TABLE sessions
          ADD CONSTRAINT sessions_user_id_foreign
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      END IF;
    END$$;
  `);
    // CHECK constraints — refuse to ever store a role / status / outcome value
    // outside the documented enum. Caught early at INSERT so a typo or a
    // forged-payload attempt cannot land bogus data in the audit trail.
    // Each block is wrapped in a name-not-exists guard so reruns are no-ops.
    const checkConstraints = [
        { table: 'users', name: 'users_role_check', expression: "role IN ('admin','coordinator','caregiver','family')" },
        { table: 'sessions', name: 'sessions_role_check', expression: "role IN ('admin','coordinator','caregiver','family')" },
        { table: 'evv_visits', name: 'evv_visits_status_check', expression: "status IN ('pending','verified','flagged')" },
        { table: 'caregivers', name: 'caregivers_status_check', expression: "status IN ('active','inactive','terminated')" },
        { table: 'audit_events', name: 'audit_events_actor_type_check', expression: "actor_type IN ('user','service','system')" },
        { table: 'audit_events', name: 'audit_events_outcome_check', expression: "outcome IN ('success','failure','denied')" },
        {
            table: 'audit_events',
            name: 'audit_events_event_type_check',
            expression: `event_type IN (
        'auth.login.success','auth.login.failure','auth.logout',
        'session.created','session.revoked','csrf.failure',
        'phi.read','phi.create','phi.update','phi.delete','phi.export',
        'request.write','permission.denied'
      )`
        }
    ];
    for (const c of checkConstraints) {
        await knex.raw(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema='public' AND table_name='${c.table}')
           AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                           WHERE table_schema='public'
                             AND table_name='${c.table}'
                             AND constraint_name='${c.name}') THEN
          ALTER TABLE ${c.table}
            ADD CONSTRAINT ${c.name} CHECK (${c.expression});
        END IF;
      END$$;
    `);
    }
    // audit_events is append-only. The compliance position is "audit rows are
    // evidence; nobody — including future-us with a SQL console open — gets to
    // edit them." A BEFORE trigger on UPDATE/DELETE/TRUNCATE raises an exception
    // so the only path to mutation is dropping the trigger first (which itself
    // is auditable in PG's DDL log).
    //
    // Drop+create is idempotent: existing trigger of this name is replaced.
    await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='audit_events') THEN
        CREATE OR REPLACE FUNCTION audit_events_block_mutation() RETURNS trigger AS $f$
        BEGIN
          RAISE EXCEPTION 'audit_events is append-only; UPDATE/DELETE refused';
        END;
        $f$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS audit_events_block_mutation_trg ON audit_events;
        CREATE TRIGGER audit_events_block_mutation_trg
          BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_events
          FOR EACH STATEMENT
          EXECUTE FUNCTION audit_events_block_mutation();
      END IF;
    END$$;
  `);
    // ── R3a — caregiver_id foreign keys ───────────────────────────────────────
    // Resolve the "would reference users/staff" comment. The intended target is
    // `caregivers.id`. `users.caregiver_id` is the denormalized linkage from a
    // login to its caregiver entity; `assignments.caregiver_id` and
    // `evv_visits.caregiver_id` carry the same uuid. We FK all three.
    //
    // Constraints are added NOT VALID so the migration succeeds even if a few
    // historical orphan rows exist (a Phase 2 maintenance task can VALIDATE
    // CONSTRAINT later once orphans are cleaned up). NOT VALID still enforces
    // the FK on every new INSERT / UPDATE.
    //
    // Delete policy:
    //   * users.caregiver_id      → ON DELETE SET NULL  (login survives staff exit)
    //   * assignments.caregiver_id → ON DELETE RESTRICT  (preserve assignment trail)
    //   * evv_visits.caregiver_id  → ON DELETE RESTRICT  (visits are evidence)
    const caregiverFks = [
        { table: 'users', column: 'caregiver_id', name: 'users_caregiver_id_foreign', onDelete: 'SET NULL' },
        { table: 'assignments', column: 'caregiver_id', name: 'assignments_caregiver_id_foreign', onDelete: 'RESTRICT' },
        { table: 'evv_visits', column: 'caregiver_id', name: 'evv_visits_caregiver_id_foreign', onDelete: 'RESTRICT' }
    ];
    for (const fk of caregiverFks) {
        await knex.raw(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema='public' AND table_name='${fk.table}')
           AND EXISTS (SELECT 1 FROM information_schema.tables
                       WHERE table_schema='public' AND table_name='caregivers')
           AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                           WHERE table_schema='public'
                             AND table_name='${fk.table}'
                             AND constraint_name='${fk.name}') THEN
          ALTER TABLE ${fk.table}
            ADD CONSTRAINT ${fk.name}
            FOREIGN KEY (${fk.column}) REFERENCES caregivers(id)
            ON DELETE ${fk.onDelete}
            NOT VALID;
        END IF;
      END$$;
    `);
    }
    // ── R4a — Cures-Act fields on evv_visits ─────────────────────────────────
    // FK client_id → clients.id (NOT VALID for upgrade safety).
    await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='evv_visits')
         AND EXISTS (SELECT 1 FROM information_schema.columns
                     WHERE table_schema='public' AND table_name='evv_visits' AND column_name='client_id')
         AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                         WHERE table_schema='public'
                           AND table_name='evv_visits'
                           AND constraint_name='evv_visits_client_id_foreign') THEN
        ALTER TABLE evv_visits
          ADD CONSTRAINT evv_visits_client_id_foreign
          FOREIGN KEY (client_id) REFERENCES clients(id)
          ON DELETE RESTRICT
          NOT VALID;
      END IF;
    END$$;
  `);
    // CHECK on service_code — only PA-supported HCPCS codes.
    await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='evv_visits')
         AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                         WHERE table_schema='public'
                           AND table_name='evv_visits'
                           AND constraint_name='evv_visits_service_code_check') THEN
        ALTER TABLE evv_visits
          ADD CONSTRAINT evv_visits_service_code_check
          CHECK (service_code IS NULL OR service_code IN ('T1019','S5125','T1004','T1021'));
      END IF;
    END$$;
  `);
    // ── R4b — evv_visits immutability ────────────────────────────────────────
    // Visits are EVV evidence. Once a visit is created, only the clock-out
    // transition (status, clock_out_time, clock_out_location) may mutate the
    // row. Any other change must go through visit_maintenance with its
    // approval workflow. A BEFORE UPDATE trigger enforces this at the DB
    // level so a rogue SQL session can't tamper with submitted billing.
    await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='evv_visits') THEN
        CREATE OR REPLACE FUNCTION evv_visits_enforce_immutability() RETURNS trigger AS $f$
        BEGIN
          IF NEW.id <> OLD.id
             OR NEW.assignment_id <> OLD.assignment_id
             OR NEW.caregiver_id <> OLD.caregiver_id
             OR NEW.client_id IS DISTINCT FROM OLD.client_id
             OR NEW.service_code IS DISTINCT FROM OLD.service_code
             OR NEW.clock_in_time <> OLD.clock_in_time
             OR NEW.clock_in_location::text <> OLD.clock_in_location::text
          THEN
            RAISE EXCEPTION 'evv_visits is immutable; corrections must go through visit_maintenance';
          END IF;
          RETURN NEW;
        END;
        $f$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS evv_visits_enforce_immutability_trg ON evv_visits;
        CREATE TRIGGER evv_visits_enforce_immutability_trg
          BEFORE UPDATE ON evv_visits
          FOR EACH ROW
          EXECUTE FUNCTION evv_visits_enforce_immutability();
      END IF;
    END$$;
  `);
    // ── R5 — widen PHI columns to fit AES-GCM ciphertext ─────────────────────
    // caregivers.npi was varchar(10) (a 10-digit NPI). After R5 column-encryption
    // it stores a `v1:<base64>` envelope (~76+ chars). Widen to text so encrypted
    // writes succeed. Idempotent: only ALTERs if the column is still varchar(10).
    await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='caregivers'
                   AND column_name='npi'
                   AND data_type='character varying'
                   AND character_maximum_length IS NOT NULL) THEN
        ALTER TABLE caregivers ALTER COLUMN npi TYPE text;
      END IF;
    END$$;
  `);
    // ── Support agent — support_conversations ───────────────────────────────
    // Public unauthenticated POST /api/support/chat lands here, two rows per
    // turn (user message then assistant reply). NOT agency-scoped — anonymous
    // marketing-site chat. The system prompt forbids the model from accepting
    // PHI; this table has no FK relationship to PHI tables either.
    if (!(await knex.schema.hasTable('support_conversations'))) {
        await knex.schema.createTable('support_conversations', (table) => {
            table.uuid('id').primary();
            table.uuid('session_id').notNullable();
            table.string('role', 16).notNullable();
            table.text('content').notNullable();
            table.string('model', 100);
            table.string('ip_address', 64);
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.index(['session_id', 'created_at']);
            table.index(['created_at']);
        });
    }
    // ── Marketing — contact_submissions ─────────────────────────────────────
    // Public unauthenticated POST /api/marketing/contact lands here. NOT
    // agency-scoped (no PHI; just lead capture). Indexed on created_at for
    // chronological review and on email for deduplication / blocklist work.
    if (!(await knex.schema.hasTable('contact_submissions'))) {
        await knex.schema.createTable('contact_submissions', (table) => {
            table.uuid('id').primary();
            table.string('name', 200).notNullable();
            table.string('email', 200).notNullable();
            table.string('agency', 200).notNullable();
            table.text('message').notNullable();
            table.string('ip_address', 64);
            table.string('user_agent', 500);
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.index(['created_at']);
            table.index(['email']);
        });
    }
    // ── R6 — mobile_sessions for revocable JWT auth ──────────────────────────
    // Mobile auth has been stateless JWT (8 h validity). On a lost-device
    // event the only mitigation was rotating JWT_SECRET, which logs out
    // every user. mobile_sessions adds a server-side row keyed by the JWT's
    // jti claim; auth-context rejects bearer tokens whose jti is absent or
    // revoked. /auth/mobile/logout revokes by jti.
    if (!(await knex.schema.hasTable('mobile_sessions'))) {
        await knex.schema.createTable('mobile_sessions', (table) => {
            table.uuid('id').primary();
            table.uuid('user_id').references('id').inTable('users').notNullable().onDelete('CASCADE');
            // The JWT's `jti` claim. Unique per session row.
            table.uuid('token_jti').notNullable().unique();
            // Optional device fingerprint supplied by the mobile client (model,
            // OS, app version). Helps support staff identify which device to
            // revoke on a lost-phone report.
            table.string('device_label');
            table.timestamp('expires_at').notNullable();
            table.timestamp('revoked_at');
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.index(['user_id']);
            table.index(['expires_at']);
        });
    }
    // ── R3b — family ↔ client relationship table ─────────────────────────────
    // The family role currently has agency-wide client.read because there is
    // no model of which clients a given family member is related to. This
    // table closes that gap: each row links a `users.id` (with role='family')
    // to a `clients.id` they are authorized to view. Repository / route work
    // uses this table to filter the client list when role === 'family'.
    if (!(await knex.schema.hasTable('family_relationships'))) {
        await knex.schema.createTable('family_relationships', (table) => {
            table.uuid('id').primary();
            table.uuid('family_user_id').references('id').inTable('users').notNullable().onDelete('CASCADE');
            table.uuid('client_id').references('id').inTable('clients').notNullable().onDelete('CASCADE');
            // Optional relationship label (parent, child, spouse, guardian, etc.)
            // — recorded for compliance/disclosure purposes but not used in authz.
            table.string('relationship_type');
            // Verifying coordinator (who confirmed this relationship). NULL until
            // verified, so admin UI can show "pending verification" pills.
            table.uuid('verified_by_user_id').references('id').inTable('users');
            table.timestamp('verified_at');
            table.timestamps(true, true);
            table.unique(['family_user_id', 'client_id']);
            table.index(['family_user_id']);
            table.index(['client_id']);
        });
    }
}
export async function down(knex) {
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
//# sourceMappingURL=schema.js.map