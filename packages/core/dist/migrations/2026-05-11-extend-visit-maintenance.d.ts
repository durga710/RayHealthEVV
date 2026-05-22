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
import type { Knex } from 'knex';
export declare function up(knex: Knex): Promise<void>;
export declare function down(knex: Knex): Promise<void>;
//# sourceMappingURL=2026-05-11-extend-visit-maintenance.d.ts.map