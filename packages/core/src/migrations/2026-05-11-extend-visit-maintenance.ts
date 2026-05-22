/**
 * Migration: extend visit_maintenance with PA DHS VMUR-required fields.
 *
 * PA DHS's Visit Maintenance Unlock Request (VMUR) submission to Sandata
 * requires every correction to carry:
 *
 *   - A reason category code drawn from the PA DHS / Sandata approved list
 *     (e.g. MTLB, MFLA, AGRS, OTHR) — not free-text.
 *   - An aggregator correction code identifying *what changed*
 *     (TIME_CHANGE, VISIT_ADDED, VISIT_CANCELED, TASK_CHANGE...).
 *   - The originator role — caregiver-initiated corrections from the mobile
 *     app are routed to a coordinator review queue, separate from
 *     coordinator-initiated corrections that fast-path to approve.
 *   - Signature completeness — PA DHS allows incomplete-signature submission
 *     with a flag so the agency can submit a visit when the client refuses
 *     to sign (the explicit user-preference behavior).
 *   - Approver ID + approval timestamp — distinct from requester.
 *
 * Idempotent: uses `hasColumn` guards. Safe to re-run.
 *
 * Reference: PA DHS / Sandata "Provider EVV Spec" — verify the live reason
 * code list against the current spec before going to production.
 */

import type { Knex } from 'knex'

const TABLE = 'visit_maintenance'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TABLE))) return

  await knex.schema.alterTable(TABLE, async (table) => {
    // ----- PA DHS VMUR fields -----
    if (!(await knex.schema.hasColumn(TABLE, 'reason_category_code'))) {
      // Sandata reason category, e.g. MTLB, MFLA, AGRS, OTHR. Stored as
      // string rather than enum so the live list can be updated without a
      // migration when PA DHS revises it.
      table.string('reason_category_code', 8).nullable()
    }
    if (!(await knex.schema.hasColumn(TABLE, 'correction_code'))) {
      // What changed about the visit. Set by the route handler based on
      // the diff between original_* and adjusted_* timestamps + payload.
      table.string('correction_code', 32).nullable()
    }
    if (!(await knex.schema.hasColumn(TABLE, 'originator_role'))) {
      // 'caregiver' | 'coordinator' | 'admin' — which actor initiated.
      table.string('originator_role', 16).nullable()
    }
    if (!(await knex.schema.hasColumn(TABLE, 'caregiver_signature_present'))) {
      table.boolean('caregiver_signature_present').nullable()
    }
    if (!(await knex.schema.hasColumn(TABLE, 'client_signature_present'))) {
      table.boolean('client_signature_present').nullable()
    }
    if (!(await knex.schema.hasColumn(TABLE, 'incomplete_signature_reason'))) {
      // Free-text — only required when one of the signatures is absent
      // and the agency still wants to submit the correction. Sandata
      // accepts this with appropriate documentation per PA DHS guidance.
      table.text('incomplete_signature_reason').nullable()
    }
    if (!(await knex.schema.hasColumn(TABLE, 'approver_id'))) {
      table.uuid('approver_id').nullable()
    }
    if (!(await knex.schema.hasColumn(TABLE, 'approved_at'))) {
      table.timestamp('approved_at').nullable()
    }
    if (!(await knex.schema.hasColumn(TABLE, 'agency_id'))) {
      // Denormalized for fast per-agency review-queue queries. Not
      // strictly required (visit_id → evv_visits → assignment → ...)
      // but every read currently traverses this graph.
      table.uuid('agency_id').nullable()
    }
  })
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
