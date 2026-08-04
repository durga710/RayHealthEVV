/**
 * Migration: agency to caregiver messaging.
 *
 * Coordinators and caregivers were communicating by personal text message,
 * which puts work conversation (and sometimes client detail) on personal
 * phones outside any retention, audit, or BAA the agency holds.
 *
 * Shape notes:
 *   - One thread per (agency, caregiver). Not per topic: a caregiver has one
 *     conversation with their office, the way a text thread works, and
 *     forcing topic selection on a phone would just push people back to SMS.
 *     The unique constraint makes "open the thread" idempotent.
 *   - A thread is agency-scoped, so a caregiver working at two agencies has
 *     two separate threads and neither agency can observe the other. That
 *     preserves the standing cross-agency privacy rule.
 *   - `sender_type` is 'staff' or 'caregiver'. `sender_user_id` is nullable
 *     because a staff account may later be deleted while the message stays.
 *   - MESSAGE BODIES ARE PHI. People will discuss clients here. Bodies are
 *     never included in a notification payload, an audit payload, or any
 *     cross-agency query; the push says only that a message arrived.
 *   - `read_at` on the thread rather than per message: unread counts only
 *     need a high-water mark, and per-message receipts would be a lot of
 *     write traffic for a feature nobody asked for.
 *
 * Idempotent via hasTable guards, safe to re-run. Callbacks are synchronous
 * on purpose: an async callback is silently dropped by knex.
 */

import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('message_threads'))) {
    await knex.schema.createTable('message_threads', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('agency_id').references('id').inTable('agencies').notNullable().onDelete('CASCADE')
      table
        .uuid('caregiver_id')
        .references('id')
        .inTable('caregivers')
        .notNullable()
        .onDelete('CASCADE')
      table.timestamp('last_message_at', { useTz: true }).nullable()
      // High-water marks for unread counts, one per side of the conversation.
      table.timestamp('caregiver_read_at', { useTz: true }).nullable()
      table.timestamp('staff_read_at', { useTz: true }).nullable()
      table.timestamps(true, true)
      // One conversation per caregiver per agency: opening a thread is
      // idempotent, and there is never a second place a message could land.
      table.unique(['agency_id', 'caregiver_id'])
      table.index(['agency_id', 'last_message_at'])
    })
  }

  if (!(await knex.schema.hasTable('messages'))) {
    await knex.schema.createTable('messages', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table
        .uuid('thread_id')
        .references('id')
        .inTable('message_threads')
        .notNullable()
        .onDelete('CASCADE')
      // Denormalized so every read can be tenant-filtered without a join.
      table.uuid('agency_id').references('id').inTable('agencies').notNullable().onDelete('CASCADE')
      // 'staff' | 'caregiver'
      table.string('sender_type', 16).notNullable()
      // Nullable: a staff account may be deleted while the message remains.
      table.uuid('sender_user_id').nullable()
      table.text('body').notNullable()
      table.timestamps(true, true)
      table.index(['thread_id', 'created_at'])
      table.index(['agency_id'])
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('messages')
  await knex.schema.dropTableIfExists('message_threads')
}
