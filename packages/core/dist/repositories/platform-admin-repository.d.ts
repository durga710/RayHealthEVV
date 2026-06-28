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
export interface PlatformStats {
    agencies: {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
    };
    users: {
        total: number;
        suspended: number;
        byRole: Record<string, number>;
    };
    clients: number;
    caregivers: {
        total: number;
        active: number;
    };
    visits: {
        total: number;
        today: number;
        last7d: number;
        verified: number;
    };
    exceptions: {
        open: number;
    };
    claims: {
        total: number;
        byStatus: Record<string, number>;
        chargedCents: number;
        paidCents: number;
    };
    generatedAt: string;
}
export interface PlatformActivityRow {
    id: string;
    eventType: string;
    entityType: string;
    actorType: string;
    outcome: string;
    agencyId: string;
    agencyName: string | null;
    occurredAt: string | null;
}
export interface PlatformAgencyDetail extends PlatformAgencyRow {
    caregiverCount: number;
    visitCount: number;
    claimCount: number;
    chargedCents: number;
    users: PlatformUserRow[];
    recentActivity: PlatformActivityRow[];
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
    /**
     * Cross-agency platform metrics for the CEO command center. Every aggregate is
     * wrapped so a missing table/column degrades that one number to 0 rather than
     * failing the whole dashboard.
     */
    getPlatformStats(): Promise<PlatformStats>;
    /** Global, cross-agency audit feed — newest first. The "monitor everything" tap. */
    getRecentActivity(limit?: number): Promise<PlatformActivityRow[]>;
    /** Deep drill-down on one agency — counts, its users, and its recent activity. */
    getAgencyDetail(agencyId: string): Promise<PlatformAgencyDetail | null>;
}
//# sourceMappingURL=platform-admin-repository.d.ts.map