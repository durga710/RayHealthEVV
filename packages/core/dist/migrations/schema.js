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
    // Address + GPS for geofencing. Added 2026-05-09 when the clock-in/
    // clock-out path started enforcing distance-from-client-address. The
    // geofence_radius_m default of 150m covers a typical detached home plus
    // driveway / front-door margin; agencies can override per-client for
    // apartment buildings (smaller) or rural acreage (larger).
    if (await knex.schema.hasTable('clients')) {
        const adds = [
            ['address_line_1', (t) => t.string('address_line_1', 200).nullable()],
            ['address_line_2', (t) => t.string('address_line_2', 200).nullable()],
            ['city', (t) => t.string('city', 100).nullable()],
            ['state', (t) => t.specificType('state', 'char(2)').nullable()],
            ['postal_code', (t) => t.string('postal_code', 10).nullable()],
            ['latitude', (t) => t.decimal('latitude', 9, 6).nullable()],
            ['longitude', (t) => t.decimal('longitude', 9, 6).nullable()],
            ['geofence_radius_m', (t) => t.integer('geofence_radius_m').nullable().defaultTo(150)]
        ];
        for (const [col, build] of adds) {
            if (!(await knex.schema.hasColumn('clients', col))) {
                await knex.schema.alterTable('clients', build);
            }
        }
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
    // Scheduled times for an assignment. Added 2026-05-09 when the mobile
    // 30-second pre-warning haptic + notification feature shipped — the
    // mobile app needs to know "this caregiver is supposed to clock in at
    // X:00 PM" so it can fire the local notification 30s prior. Without
    // these, the predecessor design relied on the caregiver clocking in
    // whenever they got there, with no scheduled-vs-actual delta.
    if (await knex.schema.hasTable('assignments')) {
        if (!(await knex.schema.hasColumn('assignments', 'scheduled_start_time'))) {
            await knex.schema.alterTable('assignments', (t) => {
                t.timestamp('scheduled_start_time').nullable();
            });
        }
        if (!(await knex.schema.hasColumn('assignments', 'scheduled_end_time'))) {
            await knex.schema.alterTable('assignments', (t) => {
                t.timestamp('scheduled_end_time').nullable();
            });
        }
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
    // Enforce per-agency email uniqueness on caregivers. The same email address
    // must not appear twice within one agency (duplicate enrollment). Cross-agency
    // is allowed (same person contracted at two agencies).
    await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='caregivers')
         AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                         WHERE table_schema='public'
                           AND table_name='caregivers'
                           AND constraint_name='caregivers_agency_email_unique') THEN
        ALTER TABLE caregivers
          ADD CONSTRAINT caregivers_agency_email_unique UNIQUE (agency_id, email);
      END IF;
    END$$;
  `);
    // Idempotent: add active_agency_id to sessions if it doesn't exist yet.
    // The column was added manually to the live DB; this guard ensures a
    // fresh schema run or test DB also picks it up.
    await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='sessions')
         AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema='public' AND table_name='sessions'
                           AND column_name='active_agency_id') THEN
        ALTER TABLE sessions
          ADD COLUMN active_agency_id UUID
          REFERENCES agencies(id) ON DELETE SET NULL;
      END IF;
    END$$;
  `);
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
    // Single-use enforcement for staff invites. Added 2026-05-09 when the
    // real invite-accept endpoints landed — without these columns we can't
    // tell whether a token has already been redeemed, which would let the
    // same invite create multiple users. Idempotent: only adds if missing.
    if (await knex.schema.hasTable('staff_invites')) {
        if (!(await knex.schema.hasColumn('staff_invites', 'accepted_at'))) {
            await knex.schema.alterTable('staff_invites', (table) => {
                table.timestamp('accepted_at').nullable();
            });
        }
        if (!(await knex.schema.hasColumn('staff_invites', 'accepted_user_id'))) {
            await knex.schema.alterTable('staff_invites', (table) => {
                table.uuid('accepted_user_id').nullable();
            });
        }
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
    // Keep audit_events_event_type_check in lock-step with the domain
    // `auditEventTypes` enum (packages/core/src/domain/audit.ts). The previous
    // version of this constraint omitted the copilot.* events, so copilot audit
    // writes were silently rejected at the DB layer (caught by the route's
    // try/catch). This DROP IF EXISTS + ADD is idempotent and now lists the full
    // enum, including copilot.*, claim.*, and payroll.export. Any change to the
    // domain enum must update this list in the same PR.
    await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='audit_events') THEN
        ALTER TABLE audit_events
          DROP CONSTRAINT IF EXISTS audit_events_event_type_check;
        ALTER TABLE audit_events
          ADD CONSTRAINT audit_events_event_type_check CHECK (event_type IN (
            'visit.created','visit.clock-out','visit.approved','visit.flagged',
            'credential.created','credential.expired','credential.renewed',
            'caregiver.created','caregiver.status-changed',
            'assignment.created','assignment.cancelled',
            'exception.filed','exception.approved',
            'auth.login.success','auth.login.failure','auth.logout',
            'session.created','session.revoked','csrf.failure',
            'phi.read','phi.create','phi.update','phi.delete','phi.export',
            'request.write','permission.denied',
            'invite.created','invite.email.sent','invite.email.failed',
            'invite.accepted','invite.access_code_failed',
            'invite.revoked','invite.revoked_all',
            'auth.password_reset.requested','auth.password_reset.completed',
            'agency.evv-config.changed',
            'copilot.query','copilot.action.confirmed','copilot.action.declined',
            'copilot.reminder.sent',
            'claim.generated','claim.validated','claim.submitted','claim.status-changed',
            'payroll.exported',
            'evv.sandata.submitted','evv.sandata.reconciled',
            'evv.hhaexchange.submitted','evv.hhaexchange.reconciled',
            'data.imported','claim.remittance.posted',
            'schedule.recurring.materialized',
            'platform.login.success','platform.login.failure',
            'agency.review.approved','agency.review.rejected',
            'account.suspended','account.reactivated'
          ));
      END IF;
    END$$;
  `);
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
    // ── Learning management (PA §52.18 training compliance) ───────────────────
    if (!(await knex.schema.hasTable('learning_courses'))) {
        await knex.schema.createTable('learning_courses', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.uuid('agency_id').references('id').inTable('agencies').onDelete('CASCADE');
            table.string('code').notNullable();
            table.string('title').notNullable();
            table.text('description').notNullable().defaultTo('');
            table.string('cadence').notNullable().defaultTo('one_time');
            table.integer('expires_after_days');
            table.boolean('required').notNullable().defaultTo(false);
            table.integer('duration_minutes').notNullable().defaultTo(0);
            table.timestamps(true, true);
            table.unique(['agency_id', 'code']);
            table.index(['agency_id']);
        });
    }
    if (!(await knex.schema.hasTable('course_enrollments'))) {
        await knex.schema.createTable('course_enrollments', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.uuid('agency_id').references('id').inTable('agencies').notNullable().onDelete('CASCADE');
            table.uuid('caregiver_id').references('id').inTable('caregivers').notNullable().onDelete('CASCADE');
            table.uuid('course_id').references('id').inTable('learning_courses').notNullable().onDelete('CASCADE');
            table.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('due_at');
            table.timestamp('last_completed_at');
            table.timestamp('expires_at');
            table.string('status').notNullable().defaultTo('not_started');
            table.timestamps(true, true);
            table.unique(['caregiver_id', 'course_id']);
            table.index(['agency_id']);
            table.index(['caregiver_id']);
            table.index(['status']);
        });
    }
    if (!(await knex.schema.hasTable('course_completions'))) {
        await knex.schema.createTable('course_completions', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.uuid('enrollment_id').references('id').inTable('course_enrollments').notNullable().onDelete('CASCADE');
            table.uuid('caregiver_id').references('id').inTable('caregivers').notNullable().onDelete('CASCADE');
            table.uuid('course_id').references('id').inTable('learning_courses').notNullable().onDelete('CASCADE');
            table.timestamp('completed_at').notNullable();
            table.integer('score');
            table.text('notes');
            table.timestamps(true, true);
            table.index(['enrollment_id']);
            table.index(['caregiver_id']);
        });
    }
    // ── R8 — Stripe billing columns on agencies ──────────────────────────────
    // Self-serve billing: each agency row tracks its Stripe customer and
    // subscription so billing routes can operate without a separate billing
    // service. subscription_status mirrors Stripe's enum so the app can gate
    // features without a live Stripe call (webhook keeps it current).
    if (await knex.schema.hasTable('agencies')) {
        const billingCols = [
            ['stripe_customer_id', (t) => t.string('stripe_customer_id').nullable()],
            ['stripe_subscription_id', (t) => t.string('stripe_subscription_id').nullable()],
            ['subscription_status', (t) => t.string('subscription_status', 32).nullable()],
            ['subscription_tier', (t) => t.string('subscription_tier', 32).nullable()],
        ];
        for (const [col, build] of billingCols) {
            if (!(await knex.schema.hasColumn('agencies', col))) {
                await knex.schema.alterTable('agencies', build);
            }
        }
    }
    // ── R9 — Caregiver onboarding pipeline ──────────────────────────────────
    // Three new tables support a fully integrated hiring funnel:
    //   applicants            — one row per job application per agency
    //   onboarding_interviews — AI chat session linked to each applicant
    //   onboarding_documents  — document checklist per applicant
    //
    // All three are tenant-scoped via agency_id (directly or through applicant_id)
    // and cascade-delete when the parent row is removed.
    if (!(await knex.schema.hasTable('applicants'))) {
        await knex.schema.createTable('applicants', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.uuid('agency_id').references('id').inTable('agencies').onDelete('CASCADE').notNullable();
            table.string('first_name', 100).notNullable();
            table.string('last_name', 100).notNullable();
            table.string('email', 200).notNullable();
            table.string('phone', 30).nullable();
            table.string('position', 100).notNullable().defaultTo('Direct Support Associate');
            table.text('cover_message').nullable();
            table.string('status', 32).notNullable().defaultTo('applied');
            table.timestamp('applied_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
            table.text('admin_notes').nullable();
            table.unique(['agency_id', 'email']);
            table.index(['agency_id', 'status']);
        });
    }
    await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='applicants')
         AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                         WHERE table_schema='public'
                           AND table_name='applicants'
                           AND constraint_name='applicants_status_check') THEN
        ALTER TABLE applicants
          ADD CONSTRAINT applicants_status_check CHECK (
            status IN ('applied','interviewing','interview_complete','under_review','offered','hired','rejected')
          );
      END IF;
    END$$;
  `);
    if (!(await knex.schema.hasTable('onboarding_interviews'))) {
        await knex.schema.createTable('onboarding_interviews', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.uuid('applicant_id').references('id').inTable('applicants').onDelete('CASCADE').notNullable();
            table.string('session_token', 128).notNullable().unique();
            table.jsonb('messages').notNullable().defaultTo('[]');
            table.text('ai_summary').nullable();
            table.integer('ai_score').nullable();
            table.string('status', 32).notNullable().defaultTo('pending');
            table.timestamp('started_at').nullable();
            table.timestamp('completed_at').nullable();
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.index(['session_token']);
            table.index(['applicant_id']);
        });
    }
    await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='onboarding_interviews')
         AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                         WHERE table_schema='public'
                           AND table_name='onboarding_interviews'
                           AND constraint_name='onboarding_interviews_status_check') THEN
        ALTER TABLE onboarding_interviews
          ADD CONSTRAINT onboarding_interviews_status_check CHECK (
            status IN ('pending','in_progress','completed')
          );
      END IF;
    END$$;
  `);
    if (!(await knex.schema.hasTable('onboarding_documents'))) {
        await knex.schema.createTable('onboarding_documents', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.uuid('applicant_id').references('id').inTable('applicants').onDelete('CASCADE').notNullable();
            table.string('document_type', 64).notNullable();
            table.string('status', 32).notNullable().defaultTo('requested');
            table.text('notes').nullable();
            table.timestamp('requested_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('submitted_at').nullable();
            table.timestamp('verified_at').nullable();
            table.uuid('verified_by_user_id').references('id').inTable('users').nullable();
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.index(['applicant_id']);
        });
    }
    await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='onboarding_documents')
         AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                         WHERE table_schema='public'
                           AND table_name='onboarding_documents'
                           AND constraint_name='onboarding_documents_status_check') THEN
        ALTER TABLE onboarding_documents
          ADD CONSTRAINT onboarding_documents_status_check CHECK (
            status IN ('requested','submitted','verified','rejected')
          );
      END IF;
    END$$;
  `);
    // ── R7 — Sandata aggregator submission tracking ───────────────────────────
    // Track each visit's lifecycle through the state aggregator pipeline.
    // Intentionally excluded from the immutability trigger's blocked list —
    // these are the only columns that legitimately change after clock-out,
    // when the background job submits to Sandata and records the acceptance.
    if (await knex.schema.hasTable('evv_visits')) {
        if (!(await knex.schema.hasColumn('evv_visits', 'sandata_status'))) {
            await knex.schema.alterTable('evv_visits', (t) => {
                t.string('sandata_status').nullable();
            });
        }
        if (!(await knex.schema.hasColumn('evv_visits', 'sandata_confirmation_id'))) {
            await knex.schema.alterTable('evv_visits', (t) => {
                t.text('sandata_confirmation_id').nullable();
            });
        }
        await knex.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = 'public'
            AND table_name = 'evv_visits'
            AND constraint_name = 'evv_visits_sandata_status_check'
        ) AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'evv_visits'
            AND column_name = 'sandata_status'
        ) THEN
          ALTER TABLE evv_visits
            ADD CONSTRAINT evv_visits_sandata_status_check
            CHECK (sandata_status IN ('pending','submitted','accepted','rejected'));
        END IF;
      END$$;
    `);
    }
    // ── R10 — user profile fields ─────────────────────────────────────────────
    if (!(await knex.schema.hasColumn('users', 'first_name'))) {
        await knex.schema.alterTable('users', (t) => {
            t.string('first_name', 100).nullable();
            t.string('last_name', 100).nullable();
            t.string('phone', 30).nullable();
            t.text('avatar_url').nullable();
        });
    }
    // ── R11 — password_reset_tokens ──────────────────────────────────────────
    if (!(await knex.schema.hasTable('password_reset_tokens'))) {
        await knex.schema.createTable('password_reset_tokens', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            table.text('token_hash').notNullable().unique();
            table.timestamp('expires_at', { useTz: true }).notNullable();
            table.timestamp('used_at', { useTz: true }).nullable();
            table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        });
    }
    // ── R12 — external_url + modules on learning_courses ─────────────────────
    if (await knex.schema.hasTable('learning_courses')) {
        if (!(await knex.schema.hasColumn('learning_courses', 'external_url'))) {
            await knex.schema.alterTable('learning_courses', (t) => {
                t.text('external_url').nullable();
            });
        }
        if (!(await knex.schema.hasColumn('learning_courses', 'modules'))) {
            await knex.schema.alterTable('learning_courses', (t) => {
                t.jsonb('modules').nullable();
            });
        }
    }
    // ── R13 — Claims & billing ───────────────────────────────────────────────
    // Medicaid claim generation. A `claims` row aggregates one client's verified
    // visits over a service period for one payer; each `claim_lines` row bills a
    // single immutable evv_visits row (one date of service). Money is stored in
    // integer cents. agency_id scopes every claim; claim_lines cascade-delete
    // with their claim, and reference evv_visits with ON DELETE RESTRICT so a
    // visit that has been billed cannot be deleted out from under a claim.
    if (!(await knex.schema.hasTable('claims'))) {
        await knex.schema.createTable('claims', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.uuid('agency_id').references('id').inTable('agencies').notNullable().onDelete('CASCADE');
            table.uuid('client_id').references('id').inTable('clients').notNullable().onDelete('RESTRICT');
            table.string('payer_id').notNullable();
            table.date('period_start').notNullable();
            table.date('period_end').notNullable();
            table.string('status', 20).notNullable().defaultTo('draft');
            table.integer('total_units').notNullable().defaultTo(0);
            table.integer('total_charge_cents').notNullable().defaultTo(0);
            table.string('denial_risk', 10).notNullable().defaultTo('low');
            table.string('control_number', 20);
            table.text('payer_claim_id');
            table.text('status_reason');
            table.timestamp('submitted_at', { useTz: true });
            table.timestamps(true, true);
            table.index(['agency_id', 'status']);
            table.index(['client_id']);
        });
    }
    await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='claims')
         AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                         WHERE table_schema='public'
                           AND table_name='claims'
                           AND constraint_name='claims_status_check') THEN
        ALTER TABLE claims
          ADD CONSTRAINT claims_status_check CHECK (
            status IN ('draft','ready','submitted','accepted','rejected','denied','paid','void')
          );
      END IF;
      IF EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='claims')
         AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                         WHERE table_schema='public'
                           AND table_name='claims'
                           AND constraint_name='claims_denial_risk_check') THEN
        ALTER TABLE claims
          ADD CONSTRAINT claims_denial_risk_check CHECK (
            denial_risk IN ('low','medium','high')
          );
      END IF;
    END$$;
  `);
    if (!(await knex.schema.hasTable('claim_lines'))) {
        await knex.schema.createTable('claim_lines', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.uuid('claim_id').references('id').inTable('claims').notNullable().onDelete('CASCADE');
            table.uuid('visit_id').references('id').inTable('evv_visits').notNullable().onDelete('RESTRICT');
            table.string('service_code').notNullable();
            table.date('service_date').notNullable();
            table.integer('units').notNullable().defaultTo(0);
            table.integer('minutes').notNullable().defaultTo(0);
            table.integer('charge_cents').notNullable().defaultTo(0);
            table.string('denial_risk', 10).notNullable().defaultTo('low');
            table.jsonb('denial_reasons').notNullable().defaultTo('[]');
            table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            // One line per visit per claim — a visit can't appear twice on a claim.
            table.unique(['claim_id', 'visit_id']);
            table.index(['claim_id']);
            table.index(['visit_id']);
        });
    }
    // ── R14 — Agency billing identity (837 billing-provider profile) ──────────
    // The 837P billing-provider loop (2010AA) needs the agency's NPI, tax id and
    // service address; the agency's clearinghouse interchange id labels the
    // receiver. These are nullable: a 837 still generates without them, but the
    // claim route flags an incomplete billing profile so an agency knows what to
    // fill before a clearinghouse will accept the file.
    if (await knex.schema.hasTable('agencies')) {
        const billingIdentityCols = [
            ['billing_npi', (t) => t.string('billing_npi', 10).nullable()],
            ['billing_tax_id', (t) => t.string('billing_tax_id', 20).nullable()],
            ['billing_address1', (t) => t.string('billing_address1', 200).nullable()],
            ['billing_city', (t) => t.string('billing_city', 100).nullable()],
            ['billing_state', (t) => t.specificType('billing_state', 'char(2)').nullable()],
            ['billing_postal_code', (t) => t.string('billing_postal_code', 10).nullable()],
            ['billing_taxonomy', (t) => t.string('billing_taxonomy', 20).nullable()],
            ['clearinghouse_id', (t) => t.string('clearinghouse_id', 40).nullable()],
        ];
        for (const [col, build] of billingIdentityCols) {
            if (!(await knex.schema.hasColumn('agencies', col))) {
                await knex.schema.alterTable('agencies', build);
            }
        }
    }
    // ── R15 — Agency fee schedule (cents per billing unit, by HCPCS code) ──────
    // Stored as jsonb { "T1019": 600, ... } keyed by service code. Drives the
    // claim line chargeCents; without it claim lines are $0 and flagged.
    if ((await knex.schema.hasTable('agencies')) &&
        !(await knex.schema.hasColumn('agencies', 'fee_schedule'))) {
        await knex.schema.alterTable('agencies', (t) => {
            t.jsonb('fee_schedule').nullable();
        });
    }
    // ── R16 — Audit retention infrastructure ──────────────────────────────────
    // The audit retention sweep moves rows older than the statutory floor
    // (PA_RETENTION_YEARS = 7) out of the hot `audit_events` table into
    // `audit_events_archive`, logging each run to `audit_retention_runs`. These
    // tables previously lived only in an orphaned dated migration that the
    // baseline runner (`schema.up`) never invokes, so prod never had them and
    // the sweep would fail. They are created here, idempotently, mirroring the
    // LIVE `audit_events` shape (actor_id/actor_type/entity_type/entity_id/
    // outcome/correlation_id) — NOT the legacy actor_user_id/resource_type shape
    // that the original archive table and sweep INSERT...SELECT were written
    // against.
    if (!(await knex.schema.hasTable('audit_events_archive'))) {
        await knex.schema.createTable('audit_events_archive', (table) => {
            // Keep id stable across the move so a future restore can re-insert by id.
            table.uuid('id').primary();
            table.uuid('agency_id').notNullable();
            table.uuid('actor_id').notNullable();
            table.string('actor_type').notNullable().defaultTo('user');
            table.string('event_type').notNullable();
            table.string('entity_type').notNullable();
            table.uuid('entity_id').notNullable();
            table.string('outcome').notNullable().defaultTo('success');
            table.string('correlation_id');
            table.jsonb('payload').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
            table.timestamp('occurred_at').notNullable();
            table.timestamp('archived_at').notNullable().defaultTo(knex.fn.now());
            table.index(['agency_id', 'occurred_at']);
            table.index(['event_type']);
        });
    }
    else {
        // Bring an archive table created by the legacy migration into alignment
        // with the live audit_events shape. Old columns (actor_user_id etc.) are
        // left in place (nullable) — dropping them could lose side-channel data.
        for (const [col, add] of [
            ['actor_id', (t) => t.uuid('actor_id')],
            ['actor_type', (t) => t.string('actor_type')],
            ['entity_type', (t) => t.string('entity_type')],
            ['entity_id', (t) => t.uuid('entity_id')],
            ['outcome', (t) => t.string('outcome')],
            ['correlation_id', (t) => t.string('correlation_id')],
        ]) {
            if (!(await knex.schema.hasColumn('audit_events_archive', col))) {
                await knex.schema.alterTable('audit_events_archive', add);
            }
        }
    }
    if (!(await knex.schema.hasTable('audit_retention_runs'))) {
        await knex.schema.createTable('audit_retention_runs', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.timestamp('started_at').notNullable();
            table.timestamp('completed_at');
            table.string('status').notNullable(); // running | success | error
            table.integer('rows_archived').notNullable().defaultTo(0);
            table.integer('rows_purged_from_hot').notNullable().defaultTo(0);
            table.timestamp('cutoff_used').notNullable();
            table.text('error_message');
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.index(['started_at']);
            table.index(['status']);
        });
    }
    // ── R17 — Import / migration source keys ───────────────────────────────────
    // Onboarding an agency off another platform (HHAeXchange, Sandata, etc.)
    // means bulk-importing their clients, caregivers, and authorizations. To make
    // re-imports idempotent and to link related rows across files, every
    // importable entity carries the SOURCE SYSTEM's id in `external_id`. We can't
    // dedupe on PHI columns (medicaid_number / npi use random-IV encryption, so
    // the same plaintext encrypts differently each time), so external_id is the
    // stable upsert key. Postgres treats NULLs as distinct in a unique index, so
    // manually-created rows (no external_id) never collide.
    //
    // clients + caregivers have agency_id → UNIQUE(agency_id, external_id).
    // authorizations scope through clients (no agency_id) → UNIQUE(client_id,
    // external_id).
    for (const tbl of ['clients', 'caregivers', 'authorizations']) {
        if (!(await knex.schema.hasTable(tbl)))
            continue;
        if (!(await knex.schema.hasColumn(tbl, 'external_id'))) {
            await knex.schema.alterTable(tbl, (t) => {
                t.string('external_id', 128).nullable();
            });
        }
        const scope = tbl === 'authorizations' ? 'client_id' : 'agency_id';
        await knex.raw(`create unique index if not exists ${tbl}_external_id_uniq
       on ${tbl} (${scope}, external_id)`);
    }
    // ── R18 — ERA / 835 remittance posting ─────────────────────────────────────
    // The back half of the billing loop: a payer returns an 835 electronic
    // remittance advice (ERA) telling us what each claim was paid / adjusted /
    // denied. `claim_remittances` records every posting (one row per CLP claim in
    // the file); a posting matched to one of our claims (by control_number) also
    // advances that claim's status + paid_cents. Unmatched postings are kept with
    // claim_id NULL so nothing in the file is silently dropped.
    if ((await knex.schema.hasTable('claims')) && !(await knex.schema.hasColumn('claims', 'paid_cents'))) {
        await knex.schema.alterTable('claims', (t) => {
            t.integer('paid_cents').notNullable().defaultTo(0);
        });
    }
    if (!(await knex.schema.hasTable('claim_remittances'))) {
        await knex.schema.createTable('claim_remittances', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.uuid('agency_id').references('id').inTable('agencies').notNullable().onDelete('CASCADE');
            table.uuid('claim_id').references('id').inTable('claims').nullable().onDelete('SET NULL');
            table.string('control_number', 40).notNullable(); // CLP01 — our patient control number
            table.text('payer_claim_control_number'); // CLP07
            table.string('status_code', 4); // CLP02 (1=paid, 4=denied, 22=reversal, …)
            table.integer('charge_cents').notNullable().defaultTo(0); // CLP03
            table.integer('paid_cents').notNullable().defaultTo(0); // CLP04
            table.integer('patient_responsibility_cents').notNullable().defaultTo(0); // CLP05
            table.integer('adjustment_cents').notNullable().defaultTo(0);
            table.jsonb('adjustment_codes').notNullable().defaultTo('[]'); // [{group,reasonCode,amountCents}]
            table.string('trace_number', 60); // TRN02 — EFT / check trace
            table.boolean('matched').notNullable().defaultTo(false);
            table.timestamp('posted_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.index(['agency_id']);
            table.index(['claim_id']);
        });
    }
    // ── R19 — Recurring schedules ──────────────────────────────────────────────
    // A recurring schedule is a weekly visit pattern (which caregiver, which
    // visit template/client, which days-of-week + time, over a date range). The
    // materializer expands it into concrete `assignments` for a rolling horizon,
    // running each occurrence through the same conflict + credential checks as a
    // manual assignment. `assignments.recurring_schedule_id` links a generated
    // assignment back to its pattern (traceability + idempotent re-materialize).
    if (!(await knex.schema.hasTable('recurring_schedules'))) {
        await knex.schema.createTable('recurring_schedules', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.uuid('agency_id').references('id').inTable('agencies').notNullable().onDelete('CASCADE');
            table.uuid('caregiver_id').notNullable();
            table.uuid('visit_template_id').references('id').inTable('visit_templates').notNullable().onDelete('CASCADE');
            // days_of_week: JSON array of ints 0(Sun)..6(Sat).
            table.jsonb('days_of_week').notNullable().defaultTo('[]');
            table.string('start_time', 5).notNullable(); // 'HH:MM'
            table.string('end_time', 5).notNullable(); // 'HH:MM'
            table.date('start_date').notNullable();
            table.date('end_date').notNullable();
            table.string('status', 12).notNullable().defaultTo('active'); // active | paused | ended
            table.timestamps(true, true);
            table.index(['agency_id', 'status']);
            table.index(['caregiver_id']);
        });
        await knex.raw(`ALTER TABLE recurring_schedules ADD CONSTRAINT recurring_schedules_status_check
       CHECK (status IN ('active','paused','ended'))`);
    }
    if ((await knex.schema.hasTable('assignments')) &&
        !(await knex.schema.hasColumn('assignments', 'recurring_schedule_id'))) {
        await knex.schema.alterTable('assignments', (t) => {
            t.uuid('recurring_schedule_id').nullable();
        });
        await knex.raw(`create index if not exists assignments_recurring_schedule_id_idx
       on assignments (recurring_schedule_id)`);
    }
    // ── R20 — HHAeXchange aggregator submission tracking ──────────────────────
    // Mirror of R7 (Sandata) for agencies whose state routes EVV through the
    // HHAeXchange aggregator instead of Sandata. Same four-state lifecycle and
    // the same exclusion from the immutability trigger — these columns change
    // legitimately after clock-out when the export batch is submitted and the
    // aggregator's accept/reject response is written back.
    if (await knex.schema.hasTable('evv_visits')) {
        if (!(await knex.schema.hasColumn('evv_visits', 'hhaexchange_status'))) {
            await knex.schema.alterTable('evv_visits', (t) => {
                t.string('hhaexchange_status').nullable();
            });
        }
        if (!(await knex.schema.hasColumn('evv_visits', 'hhaexchange_confirmation_id'))) {
            await knex.schema.alterTable('evv_visits', (t) => {
                t.text('hhaexchange_confirmation_id').nullable();
            });
        }
        await knex.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = 'public'
            AND table_name = 'evv_visits'
            AND constraint_name = 'evv_visits_hhaexchange_status_check'
        ) AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'evv_visits'
            AND column_name = 'hhaexchange_status'
        ) THEN
          ALTER TABLE evv_visits
            ADD CONSTRAINT evv_visits_hhaexchange_status_check
            CHECK (hhaexchange_status IN ('pending','submitted','accepted','rejected'));
        END IF;
      END$$;
    `);
    }
    // ── R21 — Platform super-admin: agency review gate + account suspension ────
    // The platform owner ("super admin", outside the agency tenancy) reviews
    // every new agency signup to confirm it's a real homecare agency before it
    // can operate, and can suspend any user account. `agencies.review_status`
    // gates login: 'pending' (default for NEW signups) and 'rejected' block the
    // agency's users; only 'approved' may operate. CRITICAL: every agency that
    // already exists at migration time is backfilled to 'approved' so no live
    // tenant is locked out. `users.suspended_at` (set = account terminated) is
    // checked at login and in auth-context so a suspension takes effect at once.
    if (await knex.schema.hasTable('agencies')) {
        if (!(await knex.schema.hasColumn('agencies', 'review_status'))) {
            await knex.schema.alterTable('agencies', (t) => {
                t.string('review_status', 12).notNullable().defaultTo('pending');
                t.timestamp('reviewed_at', { useTz: true }).nullable();
                t.string('reviewed_by', 100).nullable();
                t.text('review_notes').nullable();
            });
            // Backfill: all pre-existing agencies are legitimately operating, so
            // grandfather them in as approved. New signups insert 'pending' via the
            // column default. This UPDATE runs ONLY in the column-creation branch, so
            // it never re-approves an agency a super-admin later set to pending.
            await knex('agencies').update({ review_status: 'approved' });
        }
        await knex.raw(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema='public' AND table_name='agencies'
            AND constraint_name='agencies_review_status_check'
        ) THEN
          ALTER TABLE agencies
            ADD CONSTRAINT agencies_review_status_check
            CHECK (review_status IN ('pending','approved','rejected'));
        END IF;
      END$$;
    `);
    }
    if ((await knex.schema.hasTable('users')) &&
        !(await knex.schema.hasColumn('users', 'suspended_at'))) {
        await knex.schema.alterTable('users', (t) => {
            t.timestamp('suspended_at', { useTz: true }).nullable();
        });
    }
    // ── R22 — Platform super-admin WebAuthn (Face ID / device biometric) 2FA ──
    // Passkey credentials registered by the super-admin for second-factor login.
    // We store only the credential's PUBLIC key (base64url) + signature counter —
    // never any biometric data, which by design never leaves the user's device.
    // Scoped by `username` (the env SUPER_ADMIN_USERNAME) since the super-admin is
    // not a row in `users`. Multiple rows = multiple enrolled devices.
    if (!(await knex.schema.hasTable('platform_admin_credentials'))) {
        await knex.schema.createTable('platform_admin_credentials', (table) => {
            table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
            table.string('username', 100).notNullable();
            table.text('credential_id').notNullable().unique(); // base64url
            table.text('public_key').notNullable(); // base64url-encoded COSE public key
            table.bigInteger('counter').notNullable().defaultTo(0);
            table.text('transports').nullable(); // JSON array
            table.string('device_label', 120).nullable();
            table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
            table.timestamp('last_used_at', { useTz: true }).nullable();
            table.index(['username']);
        });
    }
}
export async function down(knex) {
    await knex.schema.dropTableIfExists('claim_lines');
    await knex.schema.dropTableIfExists('claims');
    await knex.schema.dropTableIfExists('password_reset_tokens');
    await knex.schema.dropTableIfExists('onboarding_documents');
    await knex.schema.dropTableIfExists('onboarding_interviews');
    await knex.schema.dropTableIfExists('applicants');
    await knex.schema.dropTableIfExists('course_completions');
    await knex.schema.dropTableIfExists('course_enrollments');
    await knex.schema.dropTableIfExists('learning_courses');
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