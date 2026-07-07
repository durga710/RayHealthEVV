/**
 * Tenant boundary for VMUR visit corrections — the one DB-sanctioned path
 * for editing an evv_visits row after the immutability trigger locks it.
 * `visit_maintenance.agency_id` is a denormalized copy for fast queue
 * reads; the authoritative link (used here for every authorization check)
 * is visit_id -> evv_visits.caregiver_id -> caregivers.agency_id, so this
 * stays correct even for rows written before that column existed.
 */
export class VisitMaintenanceRepository {
    constructor(db) {
        this.db = db;
    }
    async resolveVisitAgencyId(visitId) {
        const row = await this.db('evv_visits as v')
            .join('caregivers as c', 'c.id', 'v.caregiver_id')
            .where('v.id', visitId)
            .select('c.agency_id')
            .first();
        return row?.agency_id ?? null;
    }
    /**
     * Create an unlock request. Throws if `visitId` does not belong to
     * `agencyId` — prevents a caller from submitting (and later having
     * approved) a correction against another agency's visit.
     */
    async requestUnlock(maintenance, agencyId) {
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
     * Approve (and adjust) an unlock request — only if it belongs to
     * `agencyId`. Returns null for both "not found" and "belongs to another
     * agency" so the route can 404 without leaking cross-tenant existence.
     *
     * `approverId` is recorded on the row (approver_id + approved_at) so a
     * post-finalization billing change is always attributable to the actor who
     * authorized it — distinct from the requester. This is a non-repudiation
     * requirement for editing an otherwise immutable evv_visits row.
     */
    async approveUnlock(id, agencyId, approverId, adjustedTimes) {
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
    mapRowToMaintenance(row) {
        const toIso = (v) => v == null ? undefined : v instanceof Date ? v.toISOString() : new Date(v).toISOString();
        return {
            id: row.id,
            visitId: row.visit_id,
            agencyId: row.agency_id ?? undefined,
            requesterId: row.requester_id,
            reason: row.reason,
            status: row.status,
            adjustedStartTime: toIso(row.adjusted_start_time),
            adjustedEndTime: toIso(row.adjusted_end_time),
            approverId: row.approver_id ?? undefined,
            approvedAt: toIso(row.approved_at)
        };
    }
}
//# sourceMappingURL=visit-maintenance-repository.js.map