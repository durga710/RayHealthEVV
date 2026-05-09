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
    /** Single visit within an agency; returns null without leaking cross-tenant existence. */
    async getVisitByIdForAgency(id, agencyId) {
        const row = await this.db('evv_visits as v')
            .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
            .where('u.agency_id', agencyId)
            .andWhere('v.id', id)
            .select('v.*')
            .first();
        return row ? this.mapRowToVisit(row) : null;
    }
    /**
     * Aggregator-export rows. Each row carries all seven 21st Century Cures
     * Act data points needed by HHAeXchange / Sandata:
     *   1. service_code   (evv_visits.service_code)
     *   2. client_id      (evv_visits.client_id, falls back to template's)
     *   3. service_date   (evv_visits.clock_in_time, date portion)
     *   4. location       (evv_visits.clock_in_location, lat/lng)
     *   5. caregiver_id   (evv_visits.caregiver_id)
     *   6. start_time     (evv_visits.clock_in_time)
     *   7. end_time       (evv_visits.clock_out_time)
     *
     * Tenant-scoped via users.agency_id (caregiver linkage). Optional date
     * range filters apply to clock_in_time.
     */
    async getVisitsForExport(agencyId, fromIso, toIso) {
        let q = this.db('evv_visits as v')
            .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
            .leftJoin('assignments as a', 'a.id', 'v.assignment_id')
            .leftJoin('visit_templates as t', 't.id', 'a.visit_template_id')
            .where('u.agency_id', agencyId)
            .select('v.id as visit_id', 'v.service_code', 
        // Prefer the snapshot column on the visit itself; fall back to the
        // template's client_id for legacy rows that pre-date the Cures-Act
        // snapshot. coalesce keeps the row useful either way.
        this.db.raw('coalesce(v.client_id, t.client_id) as client_id'), 'v.caregiver_id', 'v.clock_in_time', 'v.clock_out_time', 'v.clock_in_location', 'v.clock_out_location', 'v.status')
            .orderBy('v.clock_in_time', 'asc');
        if (fromIso)
            q = q.andWhere('v.clock_in_time', '>=', fromIso);
        if (toIso)
            q = q.andWhere('v.clock_in_time', '<=', toIso);
        const rows = await q;
        return rows.map((r) => ({
            visitId: r.visit_id,
            serviceCode: r.service_code ?? null,
            clientId: r.client_id ?? null,
            caregiverId: r.caregiver_id,
            clockInTime: r.clock_in_time instanceof Date ? r.clock_in_time.toISOString() : r.clock_in_time,
            clockOutTime: r.clock_out_time instanceof Date
                ? r.clock_out_time.toISOString()
                : r.clock_out_time,
            clockInLocation: typeof r.clock_in_location === 'string'
                ? JSON.parse(r.clock_in_location)
                : r.clock_in_location,
            clockOutLocation: typeof r.clock_out_location === 'string'
                ? JSON.parse(r.clock_out_location)
                : r.clock_out_location,
            status: r.status
        }));
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