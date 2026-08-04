/**
 * Migration: RayVerify identity verification.
 *
 * Adds biometric face verification at clock-in: a caregiver enrolls a
 * reference selfie once, and each clock-in selfie is compared against it.
 *
 * LEGAL WEIGHT, read before touching any of this.
 *
 *   A face image and any template derived from it are BIOMETRIC IDENTIFIERS.
 *   Under HIPAA they are explicitly listed identifiers (§164.514(b)(2)(i)(P)
 *   covers biometric identifiers and full-face photographs), so every row here
 *   is PHI.
 *
 *   Separately from HIPAA, state biometric-privacy statutes (Illinois BIPA,
 *   Texas CUBI, Washington, and a growing list) require INFORMED WRITTEN
 *   CONSENT BEFORE collection, a published retention and destruction schedule,
 *   and a ban on selling or disclosing the data. BIPA carries a private right
 *   of action, which is why it produces the litigation it does.
 *
 *   That is why consent is a table and not a checkbox: `identity_consents`
 *   records who consented, to what text, and when. The capture endpoints
 *   refuse to store anything without a live consent row, and revoking consent
 *   deletes the enrollment. Enforce this in code, not in policy.
 *
 * Storage: images live in the BAA-covered S3 bucket already used for
 * PHI documents, never in Postgres. These tables hold the object key and the
 * verification outcome, so a retention sweep can delete the object and the row
 * together.
 *
 * Idempotent via hasTable/hasColumn guards, safe to re-run. Callbacks are
 * synchronous on purpose: an async callback is silently dropped by knex.
 */

import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('identity_consents'))) {
    await knex.schema.createTable('identity_consents', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('agency_id').references('id').inTable('agencies').notNullable().onDelete('CASCADE')
      table
        .uuid('caregiver_id')
        .references('id')
        .inTable('caregivers')
        .notNullable()
        .onDelete('CASCADE')
      // The exact text agreed to, stored verbatim. A consent record that
      // cannot show what was agreed is not evidence of anything.
      table.text('consent_text').notNullable()
      table.string('consent_version', 32).notNullable()
      table.timestamp('granted_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
      table.timestamp('revoked_at', { useTz: true }).nullable()
      table.timestamps(true, true)
      table.index(['agency_id'])
      table.index(['caregiver_id'])
    })
  }

  if (!(await knex.schema.hasTable('identity_enrollments'))) {
    await knex.schema.createTable('identity_enrollments', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('agency_id').references('id').inTable('agencies').notNullable().onDelete('CASCADE')
      table
        .uuid('caregiver_id')
        .references('id')
        .inTable('caregivers')
        .notNullable()
        .onDelete('CASCADE')
      // S3 object key for the reference selfie. The image itself never lands
      // in Postgres.
      table.string('reference_key', 500).notNullable()
      table.timestamp('enrolled_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
      table.timestamp('retired_at', { useTz: true }).nullable()
      table.timestamps(true, true)
      // One live enrollment per caregiver per agency; re-enrolling retires the
      // previous row rather than accumulating reference faces.
      table.unique(['agency_id', 'caregiver_id'])
    })
  }

  if (!(await knex.schema.hasTable('identity_verifications'))) {
    await knex.schema.createTable('identity_verifications', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('agency_id').references('id').inTable('agencies').notNullable().onDelete('CASCADE')
      table.uuid('caregiver_id').notNullable()
      // The visit this check belongs to. Nullable so a check can be recorded
      // even if the visit write later fails; no cascade, because the record of
      // a check that happened should outlive row churn.
      table.uuid('visit_id').nullable()
      table.string('capture_key', 500).nullable()
      // 'matched' | 'not_matched' | 'no_face' | 'not_enrolled' | 'error' | 'skipped'
      table.string('outcome', 24).notNullable()
      // Similarity 0..100 as reported by the provider, null when not compared.
      table.integer('similarity').nullable()
      table.string('provider', 32).notNullable().defaultTo('none')
      table.timestamps(true, true)
      table.index(['agency_id', 'created_at'])
      table.index(['visit_id'])
    })
  }

  // Denormalized outcome on the visit so Visit Review can show verification
  // state without a join, matching how sandata_status already works.
  if (await knex.schema.hasTable('evv_visits')) {
    if (!(await knex.schema.hasColumn('evv_visits', 'identity_outcome'))) {
      await knex.schema.alterTable('evv_visits', (table) => {
        table.string('identity_outcome', 24).nullable()
      })
    }
    if (!(await knex.schema.hasColumn('evv_visits', 'identity_similarity'))) {
      await knex.schema.alterTable('evv_visits', (table) => {
        table.integer('identity_similarity').nullable()
      })
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable('evv_visits')) {
    for (const col of ['identity_similarity', 'identity_outcome']) {
      if (await knex.schema.hasColumn('evv_visits', col)) {
        await knex.schema.alterTable('evv_visits', (table) => {
          table.dropColumn(col)
        })
      }
    }
  }
  await knex.schema.dropTableIfExists('identity_verifications')
  await knex.schema.dropTableIfExists('identity_enrollments')
  await knex.schema.dropTableIfExists('identity_consents')
}
