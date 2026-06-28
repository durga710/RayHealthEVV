import type { Knex } from 'knex';
import type { EvvVisit } from '../domain/evv.js';
/**
 * EvvRepository
 *
 * Multi-tenancy: `evv_visits` has no `agency_id` column. Tenant isolation is
 * enforced by joining `users.caregiver_id` → `users.agency_id`. Every read
 * and update path takes an `agencyId` argument; the unfiltered `getAllVisits`
 * was retired because it leaked PHI across agencies (HIPAA reportable).
 */
export declare class EvvRepository {
    private readonly db;
    constructor(db: Knex);
    createVisit(visit: EvvVisit): Promise<EvvVisit>;
    /**
     * Update a visit only if it belongs to the agency. Returns null when the
     * visit does not exist OR is on another tenant — callers cannot distinguish
     * the two cases (intentional: leaks neither existence nor tenancy).
     */
    updateVisit(id: string, agencyId: string, visit: Partial<EvvVisit>): Promise<EvvVisit | null>;
    /** All visits within an agency. */
    getVisitsForAgency(agencyId: string): Promise<EvvVisit[]>;
    /** Single visit within an agency; returns null without leaking cross-tenant existence. */
    getVisitByIdForAgency(id: string, agencyId: string): Promise<EvvVisit | null>;
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
    getVisitsForExport(agencyId: string, fromIso?: string, toIso?: string): Promise<Array<{
        visitId: string;
        serviceCode: string | null;
        clientId: string | null;
        caregiverId: string;
        clockInTime: string;
        clockOutTime: string | null;
        clockInLocation: unknown;
        clockOutLocation: unknown;
        status: string;
    }>>;
    /** Visits for a single caregiver. Caller must pass req.auth.caregiverId. */
    getVisitsForCaregiver(caregiverId: string): Promise<EvvVisit[]>;
    private mapRowToVisit;
    /**
     * Record the outcome of a Sandata submission attempt. Only touches the two
     * aggregator-tracking columns; all immutable visit fields are left untouched.
     * Tenant-scoped via the caregiver → users → agency join so a rogue caller
     * cannot update a visit from a different agency.
     */
    /**
     * Bulk-mark every verified visit in a date range as `submitted` — the
     * write-back for "this batch was sent to the Sandata aggregator". Only
     * advances visits that are not yet in the aggregator pipeline
     * (sandata_status IS NULL or 'pending'); never downgrades an already
     * accepted/rejected/submitted row. Tenant-scoped via the caregiver → users
     * → agency join. Returns the number of rows advanced.
     */
    markSandataSubmittedInRange(agencyId: string, fromIso?: string, toIso?: string): Promise<number>;
    markSandataSubmission(visitId: string, agencyId: string, status: 'pending' | 'submitted' | 'accepted' | 'rejected', confirmationId?: string | null): Promise<boolean>;
}
//# sourceMappingURL=evv-repository.d.ts.map