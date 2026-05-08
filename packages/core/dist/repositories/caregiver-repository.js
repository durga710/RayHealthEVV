import { decryptCell, encryptCell } from '../security/cell-cipher.js';
export class CaregiverRepository {
    constructor(db) {
        this.db = db;
    }
    async create(data) {
        const [row] = await this.db('caregivers').insert({
            id: this.db.raw('gen_random_uuid()'),
            agency_id: data.agencyId,
            first_name: data.firstName,
            last_name: data.lastName,
            email: data.email,
            phone: data.phone ?? null,
            // Encrypt NPI at write. Column was varchar(10) — widened to text in
            // the R5 schema migration so ciphertext (~76+ chars) fits.
            npi: encryptCell(data.npi),
            hire_date: data.hireDate ?? null,
            status: data.status ?? 'active',
        }).returning('*');
        return this.mapCaregiver(row);
    }
    async findById(id) {
        const row = await this.db('caregivers').where({ id }).first();
        return row ? this.mapCaregiver(row) : undefined;
    }
    async findByAgency(agencyId) {
        const rows = await this.db('caregivers').where({ agency_id: agencyId });
        return rows.map((r) => this.mapCaregiver(r));
    }
    async findByEmail(email) {
        const row = await this.db('caregivers').where({ email }).first();
        return row ? this.mapCaregiver(row) : undefined;
    }
    async updateStatus(id, status) {
        await this.db('caregivers').where({ id }).update({ status });
    }
    async saveCredential(credential) {
        const [row] = await this.db('caregiver_credentials').insert({
            id: this.db.raw('gen_random_uuid()'),
            caregiver_id: credential.caregiverId,
            credential_type: credential.credentialType,
            status: credential.status ?? 'pending',
            expires_at: credential.expiresAt,
            issued_at: credential.issuedAt ?? null,
            notes: credential.notes ?? null,
        }).returning('*');
        return this.mapCredential(row);
    }
    async getCredentials(caregiverId) {
        const rows = await this.db('caregiver_credentials').where({ caregiver_id: caregiverId });
        return rows.map((r) => this.mapCredential(r));
    }
    async expireCredential(id) {
        await this.db('caregiver_credentials').where({ id }).update({ status: 'expired' });
    }
    async createInvite(invite) {
        const [row] = await this.db('staff_invites').insert({
            id: this.db.raw('gen_random_uuid()'),
            agency_id: invite.agencyId,
            email: invite.email,
            role: invite.role,
            status: invite.status ?? 'pending',
            invited_by: invite.invitedBy,
            expires_at: invite.expiresAt,
        }).returning('*');
        return this.mapInvite(row);
    }
    mapCaregiver(row) {
        return {
            id: row.id,
            agencyId: row.agency_id,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email,
            phone: row.phone,
            npi: (decryptCell(row.npi) ?? undefined),
            hireDate: row.hire_date instanceof Date
                ? row.hire_date.toISOString().split('T')[0]
                : row.hire_date,
            status: row.status,
        };
    }
    mapCredential(row) {
        return {
            id: row.id,
            caregiverId: row.caregiver_id,
            credentialType: row.credential_type,
            status: row.status,
            expiresAt: row.expires_at instanceof Date
                ? row.expires_at.toISOString().split('T')[0]
                : row.expires_at,
            issuedAt: row.issued_at instanceof Date
                ? row.issued_at.toISOString().split('T')[0]
                : row.issued_at,
            notes: row.notes,
        };
    }
    mapInvite(row) {
        return {
            id: row.id,
            agencyId: row.agency_id,
            email: row.email,
            role: row.role,
            status: row.status,
            invitedBy: row.invited_by,
            expiresAt: row.expires_at instanceof Date
                ? row.expires_at.toISOString()
                : row.expires_at,
        };
    }
}
//# sourceMappingURL=caregiver-repository.js.map