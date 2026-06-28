import type { Knex } from 'knex';
/**
 * Platform super-admin data access. The super-admin lives OUTSIDE the agency
 * tenancy model, so unlike every other repository these queries are
 * deliberately cross-agency. Only `superadmin-routes.ts` (behind
 * requirePlatformAdmin) may use this class.
 */
/** Fixed actor id for super-admin audit rows (super-admin has no users.id). */
export declare const SUPER_ADMIN_ACTOR_ID = "00000000-0000-0000-0000-0000000000ad";
export type AgencyReviewStatus = 'pending' | 'approved' | 'rejected';
export interface PlatformAgencyRow {
    id: string;
    name: string;
    state: string;
    reviewStatus: AgencyReviewStatus;
    reviewedAt: string | null;
    reviewedBy: string | null;
    reviewNotes: string | null;
    createdAt: string | null;
    userCount: number;
    clientCount: number;
    adminEmails: string[];
}
export interface PlatformUserRow {
    id: string;
    email: string;
    role: string;
    agencyId: string;
    agencyName: string | null;
    createdAt: string | null;
    suspendedAt: string | null;
}
export declare class PlatformAdminRepository {
    private readonly db;
    constructor(db: Knex);
    /** Every agency, newest first, with signup metadata and roll-up counts. */
    listAgencies(): Promise<PlatformAgencyRow[]>;
    /**
     * Set an agency's review decision. Returns the updated row's id and name (for
     * the audit payload) or null if the agency doesn't exist.
     */
    setAgencyReview(agencyId: string, status: AgencyReviewStatus, reviewedBy: string, notes: string | null): Promise<{
        id: string;
        name: string;
    } | null>;
    /** Every user across all agencies, newest first. */
    listUsers(): Promise<PlatformUserRow[]>;
    /**
     * Suspend (terminate) or reactivate a user account. Suspending also revokes
     * the user's active sessions so the lock-out is immediate. Returns the
     * affected user's agencyId + email for the audit row, or null if not found.
     */
    setUserSuspended(userId: string, suspended: boolean): Promise<{
        agencyId: string;
        email: string;
    } | null>;
}
//# sourceMappingURL=platform-admin-repository.d.ts.map