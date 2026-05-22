/**
 * Migration: Learning Hub — courses, enrollments, completions.
 *
 * Three tables:
 *
 *   learning_courses        — catalog. agency_id NULL = global course shared
 *                             across all agencies (e.g. HIPAA refresh).
 *   course_enrollments      — one row per (caregiver, course). Tracks the
 *                             current state — last completion, expiry.
 *   course_completions      — append-only event log of completion records.
 *
 * Idempotent.
 */

import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('learning_courses'))) {
    await knex.schema.createTable('learning_courses', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('agency_id').references('id').inTable('agencies').onDelete('CASCADE')
      table.string('code', 64).notNullable()
      table.string('title').notNullable()
      table.text('description').notNullable().defaultTo('')
      table.string('cadence', 24).notNullable() // 'one_time' | 'annual' | 'biennial' | 'certification'
      table.integer('expires_after_days') // null = never expires
      table.boolean('required').notNullable().defaultTo(true)
      table.integer('duration_minutes').notNullable().defaultTo(0)
      table.timestamps(true, true)
      // A course code is unique within an agency, and globally for global courses.
      table.unique(['agency_id', 'code'])
    })
  }

  if (!(await knex.schema.hasTable('course_enrollments'))) {
    await knex.schema.createTable('course_enrollments', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('agency_id').references('id').inTable('agencies').onDelete('CASCADE').notNullable()
      table.uuid('caregiver_id').references('id').inTable('caregivers').onDelete('CASCADE').notNullable()
      table.uuid('course_id').references('id').inTable('learning_courses').onDelete('CASCADE').notNullable()
      table.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now())
      table.timestamp('due_at')
      table.timestamp('last_completed_at')
      table.timestamp('expires_at')
      table.string('status', 24).notNullable().defaultTo('not_started')
      table.timestamps(true, true)
      // A caregiver can only have one active enrollment per course.
      table.unique(['caregiver_id', 'course_id'])
      table.index(['agency_id', 'status'])
      table.index(['caregiver_id'])
    })
  }

  if (!(await knex.schema.hasTable('course_completions'))) {
    await knex.schema.createTable('course_completions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('enrollment_id').references('id').inTable('course_enrollments').onDelete('CASCADE').notNullable()
      table.uuid('caregiver_id').references('id').inTable('caregivers').onDelete('CASCADE').notNullable()
      table.uuid('course_id').references('id').inTable('learning_courses').onDelete('CASCADE').notNullable()
      table.timestamp('completed_at').notNullable()
      table.integer('score') // 0–100, null for non-quiz courses
      table.text('notes')
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
      table.index(['caregiver_id', 'course_id'])
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('course_completions')
  await knex.schema.dropTableIfExists('course_enrollments')
  await knex.schema.dropTableIfExists('learning_courses')
}
