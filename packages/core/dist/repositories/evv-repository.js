/**
 * EvvRepository
 *
 * Multi-tenancy: `evv_visits` has no `agency_id` column. Tenant isolation is
 * enforced by joining `users.caregiver_id` → `users.agency_id`. Every read
 * and update path takes an `agencyId` argument; the unfiltered `getAllVisits`
 * was retired because it leaked PHI across agencies (HIPAA reportable).
 */
export class EvvRepository {
    constructor(db) {
        this.db = db;
    }
    async createVisit(visit) {
        const [inserted] = await this.db('evv_visits')
            .insert({
            id: visit.id ?? crypto.randomUUID(),
            assignment_id: visit.assignmentId,
            caregiver_id: visit.caregiverId,
            // Cures-Act #1 / #2 — service code and beneficiary snapshotted at
            // clock-in. Both are nullable in the column but the Cures-Act
            // submission to PA aggregators requires both, so the route layer
            // supplies them on creation.
            service_code: visit.serviceCode ?? null,
            client_id: visit.clientId ?? null,
            clock_in_time: visit.clockInTime,
            clock_in_location: JSON.stringify(visit.clockInLocation),
            status: visit.status
        })
            .returning('*');
        return this.mapRowToVisit(inserted);
    }
    /**
     * Update a visit only if it belongs to the agency. Returns null when the
     * visit does not exist OR is on another tenant — callers cannot distinguish
     * the two cases (intentional: leaks neither existence nor tenancy).
     */
    async updateVisit(id, agencyId, visit) {
        const updateData = {};
        if (visit.clockOutTime)
            updateData.clock_out_time = visit.clockOutTime;
        if (visit.clockOutLocation)
            updateData.clock_out_location = JSON.stringify(visit.clockOutLocation);
        if (visit.status)
            updateData.status = visit.status;
        const allowedIds = this.db('evv_visits as v')
            .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
            .where('u.agency_id', agencyId)
            .andWhere('v.id', id)
            .select('v.id');
        const [updated] = await this.db('evv_visits')
            .whereIn('id', allowedIds)
            .update(updateData)
            .returning('*');
        return updated ? this.mapRowToVisit(updated) : null;
    }
    /** All visits within an agency. */
    async getVisitsForAgency(agencyId) {
        const rows = await this.db('evv_visits as v')
            .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
            .where('u.agency_id', agencyId)
            .select('v.*');
        return rows.map((row) => this.mapRowToVisit(row));
    }
    /** Visits for a single caregiver. Caller must pass req.auth.caregiverId. */
    async getVisitsForCaregiver(caregiverId) {
        const rows = await this.db('evv_visits')
            .where({ caregiver_id: caregiverId })
            .select('*');
        return rows.map((row) => this.mapRowToVisit(row));
    }
    mapRowToVisit(row) {
        const clockIn = row.clock_in_time;
        const clockOut = row.clock_out_time;
        const inLoc = row.clock_in_location;
        const outLoc = row.clock_out_location;
        return {
            id: row.id,
            assignmentId: row.assignment_id,
            caregiverId: row.caregiver_id,
            clientId: row.client_id ?? undefined,
            serviceCode: row.service_code ?? undefined,
            clockInTime: clockIn instanceof Date ? clockIn.toISOString() : clockIn,
            clockOutTime: clockOut instanceof Date
                ? clockOut.toISOString()
                : clockOut,
            clockInLocation: typeof inLoc === 'string'
                ? JSON.parse(inLoc)
                : inLoc,
            clockOutLocation: typeof outLoc === 'string'
                ? JSON.parse(outLoc)
                : outLoc,
            status: row.status
        };
    }
}
//# sourceMappingURL=evv-repository.js.map