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
    /** Visits for a single caregiver. Caller must pass req.auth.caregiverId. */
    getVisitsForCaregiver(caregiverId: string): Promise<EvvVisit[]>;
    private mapRowToVisit;
}
//# sourceMappingURL=evv-repository.d.ts.map