const TABLE = 'evv_visits';
export async function up(knex) {
    if (!(await knex.schema.hasTable(TABLE)))
        return;
    if (!(await knex.schema.hasColumn(TABLE, 'clock_in_client_event_id'))) {
        await knex.schema.alterTable(TABLE, (table) => {
            table.uuid('clock_in_client_event_id').nullable().unique();
        });
    }
    if (!(await knex.schema.hasColumn(TABLE, 'clock_out_client_event_id'))) {
        await knex.schema.alterTable(TABLE, (table) => {
            table.uuid('clock_out_client_event_id').nullable().unique();
        });
    }
    if (!(await knex.schema.hasColumn(TABLE, 'clock_in_capture_mode'))) {
        await knex.schema.alterTable(TABLE, (table) => {
            table.string('clock_in_capture_mode', 10).notNullable().defaultTo('online');
        });
    }
    if (!(await knex.schema.hasColumn(TABLE, 'clock_out_capture_mode'))) {
        await knex.schema.alterTable(TABLE, (table) => {
            table.string('clock_out_capture_mode', 10).nullable();
        });
    }
    await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'evv_visits'
          AND constraint_name = 'evv_visits_clock_in_capture_mode_check'
      ) THEN
        ALTER TABLE evv_visits ADD CONSTRAINT evv_visits_clock_in_capture_mode_check
          CHECK (clock_in_capture_mode IN ('online','offline'));
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'evv_visits'
          AND constraint_name = 'evv_visits_clock_out_capture_mode_check'
      ) THEN
        ALTER TABLE evv_visits ADD CONSTRAINT evv_visits_clock_out_capture_mode_check
          CHECK (clock_out_capture_mode IS NULL OR clock_out_capture_mode IN ('online','offline'));
      END IF;
    END$$;
  `);
}
export async function down(knex) {
    if (!(await knex.schema.hasTable(TABLE)))
        return;
    await knex.raw(`
    ALTER TABLE evv_visits
      DROP CONSTRAINT IF EXISTS evv_visits_clock_out_capture_mode_check,
      DROP CONSTRAINT IF EXISTS evv_visits_clock_in_capture_mode_check
  `);
    for (const column of [
        'clock_out_capture_mode',
        'clock_in_capture_mode',
        'clock_out_client_event_id',
        'clock_in_client_event_id',
    ]) {
        if (await knex.schema.hasColumn(TABLE, column)) {
            await knex.schema.alterTable(TABLE, (table) => table.dropColumn(column));
        }
    }
}
//# sourceMappingURL=2026-07-12-add-offline-evv-metadata.js.map