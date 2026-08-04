/**
 * Migration: resume state on course enrollments.
 *
 * Adds two nullable columns to `course_enrollments` so the in-app course
 * player can put a caregiver back where they left off:
 *   - resume_state       jsonb        { stepIndex, answers } as last seen
 *   - resume_updated_at  timestamptz  when that snapshot was written
 *
 * Server-side rather than device-local on purpose: a caregiver who reinstalls
 * the app, switches phones, or works at a second agency should not lose a
 * half-finished mandatory training. NULL means "never started", which is
 * exactly the pre-migration behavior, so no backfill is needed.
 *
 * The payload is deliberately position-only (a step index and the chosen
 * answer indexes). It carries no PHI and no free text.
 *
 * Idempotent via hasColumn guards, safe to re-run. Note the alterTable
 * callbacks are synchronous: an async callback here is silently dropped by
 * knex and the column never lands.
 */

import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('course_enrollments'))) return
  if (!(await knex.schema.hasColumn('course_enrollments', 'resume_state'))) {
    await knex.schema.alterTable('course_enrollments', (table) => {
      table.jsonb('resume_state')
    })
  }
  if (!(await knex.schema.hasColumn('course_enrollments', 'resume_updated_at'))) {
    await knex.schema.alterTable('course_enrollments', (table) => {
      table.timestamp('resume_updated_at', { useTz: true })
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('course_enrollments'))) return
  for (const col of ['resume_updated_at', 'resume_state']) {
    if (await knex.schema.hasColumn('course_enrollments', col)) {
      await knex.schema.alterTable('course_enrollments', (table) => {
        table.dropColumn(col)
      })
    }
  }
}
