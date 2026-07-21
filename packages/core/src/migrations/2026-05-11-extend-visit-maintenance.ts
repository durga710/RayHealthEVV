/**
 * Migration: extend visit_maintenance with PA DHS VMUR-required fields.
 *
 * PA DHS's Visit Maintenance Unlock Request (VMUR) submission to Sandata
 * requires every correction to carry:
 *
 *   - A reason category code drawn from the PA DHS / Sandata approved list
 *     (e.g. MTLB, MFLA, AGRS, OTHR), not free-text.
 *   - An aggregator correction code identifying *what changed*
 *     (TIME_CHANGE, VISIT_ADDED, VISIT_CANCELED, TASK_CHANGE...).
 *   - The originator role, caregiver-initiated corrections from the mobile
 *     app are routed to a coordinator review queue, separate from
 *     coordinator-initiated corrections that fast-path to approve.
 *   - Signature completeness. PA DHS allows incomplete-signature submission
 *     with a flag so the agency can submit a visit when the client refuses
 *     to sign (the explicit user-preference behavior).
 *   - Approver ID + approval timestamp, distinct from requester.
 *
 * Idempotent: uses `hasColumn` guards. Safe to re-run.
 *
 * Reference: PA DHS / Sandata "Provider EVV Spec", verify the live reason
 * code list against the current spec before going to production.
 */

import type { Knex } from 'knex'

const TABLE = 'visit_maintenance'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TABLE))) return

  // The hasColumn checks must run BEFORE alterTable: knex compiles the DDL
  // synchronously when the builder callback returns, so awaiting inside the
  // callback produces an empty ALTER and none of the columns get added (an
  // earlier version of this migration did exactly that, leaving fresh
  // databases without any of these columns).
  //
  // Column notes:
  //   - reason_category_code: Sandata reason category (MTLB, MFLA, AGRS,
  //     OTHR). String rather than enum so the live list can change without
  //     a migration when PA DHS revises it.
  //   - correction_code: what changed about the visit, set by the route
  //     handler from the original_*/adjusted_* diff.
  //   - originator_role: 'caregiver' | 'coordinator' | 'admin'.
  //   - incomplete_signature_reason: free text, only required when a
  //     signature is absent and the agency still submits the correction.
  //   - agency_id: denormalized owning agency for fast per-agency
  //     review-queue queries (authoritative link is visit → caregiver).
  const adds: Array<[string, (t: Knex.AlterTableBuilder) => void]> = [
    ['reason_category_code', (t) => { t.string('reason_category_code', 8).nullable() }],
    ['correction_code', (t) => { t.string('correction_code', 32).nullable() }],
    ['originator_role', (t) => { t.string('originator_role', 16).nullable() }],
    ['caregiver_signature_present', (t) => { t.boolean('caregiver_signature_present').nullable() }],
    ['client_signature_present', (t) => { t.boolean('client_signature_present').nullable() }],
    ['incomplete_signature_reason', (t) => { t.text('incomplete_signature_reason').nullable() }],
    ['approver_id', (t) => { t.uuid('approver_id').nullable() }],
    ['approved_at', (t) => { t.timestamp('approved_at').nullable() }],
    ['agency_id', (t) => { t.uuid('agency_id').nullable() }]
  ]
  for (const [col, build] of adds) {
    if (!(await knex.schema.hasColumn(TABLE, col))) {
      await knex.schema.alterTable(TABLE, build)
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TABLE))) return
  await knex.schema.alterTable(TABLE, (table) => {
    table.dropColumn('reason_category_code')
    table.dropColumn('correction_code')
    table.dropColumn('originator_role')
    table.dropColumn('caregiver_signature_present')
    table.dropColumn('client_signature_present')
    table.dropColumn('incomplete_signature_reason')
    table.dropColumn('approver_id')
    table.dropColumn('approved_at')
    table.dropColumn('agency_id')
  })
}
