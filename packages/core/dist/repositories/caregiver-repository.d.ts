import type { Knex } from 'knex';
import type { Caregiver, CaregiverCredential, StaffInvite } from '../domain/caregiver.js';
export declare class CaregiverRepository {
    private readonly db;
    constructor(db: Knex);
    create(data: Omit<Caregiver, 'id'>): Promise<Caregiver>;
    findById(id: string): Promise<Caregiver | undefined>;
    findByAgency(agencyId: string): Promise<Caregiver[]>;
    findByEmail(email: string): Promise<Caregiver | undefined>;
    updateStatus(id: string, status: 'active' | 'inactive' | 'suspended'): Promise<void>;
    saveCredential(credential: Omit<CaregiverCredential, 'id'>): Promise<CaregiverCredential>;
    getCredentials(caregiverId: string): Promise<CaregiverCredential[]>;
    expireCredential(id: string): Promise<void>;
    createInvite(invite: Omit<StaffInvite, 'id'>): Promise<StaffInvite>;
    private mapCaregiver;
    private mapCredential;
    private mapInvite;
}
//# sourceMappingURL=caregiver-repository.d.ts.map