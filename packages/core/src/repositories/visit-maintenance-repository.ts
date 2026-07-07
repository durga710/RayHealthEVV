import type { Knex } from 'knex';
import type { VisitMaintenance } from '../domain/visit-maintenance.js';

/**
 * Tenant boundary for VMUR visit corrections, the one DB-sanctioned path
 * for editing an evv_visits row after the immutability trigger locks it.
 * `visit_maintenance.agency_id` is a denormalized copy for fast queue
 * reads; the authoritative link (used here for every authorization check)
 * is visit_id -> evv_visits.caregiver_id -> caregivers.agency_id, so this
 * stays correct even for rows written before that column existed.
 */
export class VisitMaintenanceRepository {
  constructor(private readonly db: Knex) {}

  private async resolveVisitAgencyId(visitId: string): Promise<string | null> {
    const row = await this.db('evv_visits as v')
      .join('caregivers as c', 'c.id', 'v.caregiver_id')
      .where('v.id', visitId)
      .select('c.agency_id')
      .first<{ agency_id: string } | undefined>();
    return row?.agency_id ?? null;
  }

  /**
   * Create an unlock request. Throws if `visitId` does not belong to
   * `agencyId`, prevents a caller from submitting (and later having
   * approved) a correction against another agency's visit.
   */
  async requestUnlock(
    maintenance: Omit<VisitMaintenance, 'agencyId'>,
    agencyId: string
  ): Promise<VisitMaintenance> {
    const ownerAgencyId = await this.resolveVisitAgencyId(maintenance.visitId);
    if (!ownerAgencyId || ownerAgencyId !== agencyId) {
      throw new Error('visit not found in this agency');
    }

    const [inserted] = await this.db('visit_maintenance').insert({
      id: maintenance.id ?? crypto.randomUUID(),
      visit_id: maintenance.visitId,
      agency_id: agencyId,
      requester_id: maintenance.requesterId,
      reason: maintenance.reason,
      status: 'pending'
    }).returning('*');

    return this.mapRowToMaintenance(inserted);
  }

  /**
   * Approve (and adjust) an unlock request, only if it belongs to
   * `agencyId`. Returns null for both "not found" and "belongs to another
   * agency" so the route can 404 without leaking cross-tenant existence.
   *
   * `approverId` is recorded on the row (approver_id + approved_at) so a
   * post-finalization billing change is always attributable to the actor who
   * authorized it, distinct from the requester. This is a non-repudiation
   * requirement for editing an otherwise immutable evv_visits row.
   */
  async approveUnlock(
    id: string,
    agencyId: string,
    approverId: string,
    adjustedTimes: { start: string; end: string }
  ): Promise<VisitMaintenance | null> {
    const allowedIds = this.db('visit_maintenance as m')
      .join('evv_visits as v', 'v.id', 'm.visit_id')
      .join('caregivers as c', 'c.id', 'v.caregiver_id')
      .where('c.agency_id', agencyId)
      .andWhere('m.id', id)
      .select('m.id');

    const [updated] = await this.db('visit_maintenance')
      .whereIn('id', allowedIds)
      .update({
        status: 'approved',
        adjusted_start_time: adjustedTimes.start,
        adjusted_end_time: adjustedTimes.end,
        approver_id: approverId,
        approved_at: this.db.fn.now(),
        // Opportunistically backfills agency_id for any row that
        // predates the column being populated on insert.
        agency_id: agencyId
      })
      .returning('*');

    return updated ? this.mapRowToMaintenance(updated) : null;
  }

  /**
   * Agency-scoped VMUR read for a single visit, the accountability trail
   * for the audit packet (`GET /admin/audit-packet/:visitId`). Uses the same
   * `evv_visits -> caregivers.agency_id` authorization join as every other
   * method on this repository (never `visit_maintenance.agency_id` alone,
   * since older rows may predate that denormalized column). Left-joins
   * `users` twice (requester, approver) to surface a display name, those
   * names are not stored on the visit_maintenance row itself.
   *
   * Ordered newest-first so the packet renders the most recent correction
   * activity at the top of the VMUR trail.
   */
  async findByVisitIdForAgency(
    visitId: string,
    agencyId: string
  ): Promise<Array<VisitMaintenance & { requesterName: string | null; approverName: string | null }>> {
    const rows = await this.db('visit_maintenance as m')
      .join('evv_visits as v', 'v.id', 'm.visit_id')
      .join('caregivers as c', 'c.id', 'v.caregiver_id')
      .leftJoin('users as ru', 'ru.id', 'm.requester_id')
      .leftJoin('users as au', 'au.id', 'm.approver_id')
      .where('c.agency_id', agencyId)
      .andWhere('m.visit_id', visitId)
      .orderBy('m.created_at', 'desc')
      .select(
        'm.*',
        'ru.first_name as requester_first_name',
        'ru.last_name as requester_last_name',
        'au.first_name as approver_first_name',
        'au.last_name as approver_last_name'
      );

    return rows.map((row) => {
      const requesterName = joinName(row.requester_first_name, row.requester_last_name);
      const approverName = joinName(row.approver_first_name, row.approver_last_name);
      return { ...this.mapRowToMaintenance(row), requesterName, approverName };
    });
  }

  private mapRowToMaintenance(row: any): VisitMaintenance {
    const toIso = (v: Date | string | null | undefined): string | undefined =>
      v == null ? undefined : v instanceof Date ? v.toISOString() : new Date(v).toISOString();
    return {
      id: row.id,
      visitId: row.visit_id,
      agencyId: row.agency_id ?? undefined,
      requesterId: row.requester_id,
      reason: row.reason,
      reasonCategoryCode: row.reason_category_code ?? undefined,
      correctionCode: row.correction_code ?? undefined,
      originatorRole: row.originator_role ?? undefined,
      status: row.status,
      originalStartTime: toIso(row.original_start_time),
      originalEndTime: toIso(row.original_end_time),
      adjustedStartTime: toIso(row.adjusted_start_time),
      adjustedEndTime: toIso(row.adjusted_end_time),
      caregiverSignaturePresent: row.caregiver_signature_present ?? undefined,
      clientSignaturePresent: row.client_signature_present ?? undefined,
      incompleteSignatureReason: row.incomplete_signature_reason ?? undefined,
      approverId: row.approver_id ?? undefined,
      approvedAt: toIso(row.approved_at)
    };
  }
}

/** Joins first/last name parts, dropping either side that is missing; null when both are. */
function joinName(first: string | null | undefined, last: string | null | undefined): string | null {
  const parts = [first, last].filter((p): p is string => Boolean(p && p.trim().length > 0));
  return parts.length > 0 ? parts.join(' ') : null;
}