import type { Knex } from 'knex';
import type { Caregiver, CaregiverCredential, PersistedStaffInvite, StaffInvite } from '../domain/caregiver.js';
export declare class CaregiverRepository {
    private readonly db;
    constructor(db: Knex);
    create(data: Omit<Caregiver, 'id'>): Promise<Caregiver>;
    findById(id: string, agencyId: string): Promise<Caregiver | undefined>;
    findByAgency(agencyId: string): Promise<Caregiver[]>;
    findByEmail(email: string, agencyId: string): Promise<Caregiver | undefined>;
    updateStatus(id: string, agencyId: string, status: 'active' | 'inactive' | 'terminated'): Promise<void>;
    /**
     * Set a caregiver's NPI (rendering-provider id for the 837 service line).
     * Stored encrypted via the cell cipher. Returns false if the caregiver is
     * not in the agency.
     */
    updateNpi(id: string, agencyId: string, npi: string): Promise<boolean>;
    saveCredential(credential: Omit<CaregiverCredential, 'id'>): Promise<CaregiverCredential>;
    getCredentials(caregiverId: string, agencyId: string): Promise<CaregiverCredential[]>;
    expireCredential(id: string, agencyId: string): Promise<void>;
    createInvite(invite: Omit<StaffInvite, 'id'>): Promise<PersistedStaffInvite>;
    /**
     * Look up an invite by its UUID (which is the share-token). Returns
     * undefined for unknown ids so the caller can render a generic
     * "invalid or expired" message without confirming whether the id was
     * ever issued. Includes the agency name so the accept-invite UI can
     * show "you're joining <Agency>" before the user types a password.
     */
    findInviteById(id: string): Promise<(PersistedStaffInvite & {
        acceptedAt: string | null;
        agencyName: string | null;
    }) | undefined>;
    /**
     * Mark an invite as redeemed. Idempotent only in the trivial sense —
     * if `accepted_at` is already non-null the caller should treat the
     * invite as already-used and refuse to create another user. The route
     * layer enforces single-use; this method just persists the marker.
     */
    markInviteAccepted(id: string, acceptedUserId: string, acceptedAt: string): Promise<void>;
    private mapCaregiver;
    private mapCredential;
    private mapInvite;
}
//# sourceMappingURL=caregiver-repository.d.ts.map