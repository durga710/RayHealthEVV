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
    async findById(id, agencyId) {
        const row = await this.db('caregivers').where({ id, agency_id: agencyId }).first();
        return row ? this.mapCaregiver(row) : undefined;
    }
    async findByAgency(agencyId) {
        const rows = await this.db('caregivers').where({ agency_id: agencyId });
        return rows.map((r) => this.mapCaregiver(r));
    }
    async findByEmail(email, agencyId) {
        const row = await this.db('caregivers').where({ email, agency_id: agencyId }).first();
        return row ? this.mapCaregiver(row) : undefined;
    }
    async updateStatus(id, agencyId, status) {
        const updated = await this.db('caregivers').where({ id, agency_id: agencyId }).update({ status });
        if (updated === 0)
            throw new Error('caregiver not found in agency');
    }
    /**
     * Set a caregiver's NPI (rendering-provider id for the 837 service line).
     * Stored encrypted via the cell cipher. Returns false if the caregiver is
     * not in the agency.
     */
    async updateNpi(id, agencyId, npi) {
        const updated = await this.db('caregivers')
            .where({ id, agency_id: agencyId })
            .update({ npi: encryptCell(npi) });
        return updated > 0;
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
    async getCredentials(caregiverId, agencyId) {
        const rows = await this.db('caregiver_credentials as cc')
            .join('caregivers as c', 'c.id', 'cc.caregiver_id')
            .where({ 'cc.caregiver_id': caregiverId, 'c.agency_id': agencyId })
            .select('cc.*');
        return rows.map((r) => this.mapCredential(r));
    }
    async expireCredential(id, agencyId) {
        await this.db('caregiver_credentials as cc')
            .join('caregivers as c', 'c.id', 'cc.caregiver_id')
            .where({ 'cc.id': id, 'c.agency_id': agencyId })
            .update({ 'cc.status': 'expired' });
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
    /**
     * Look up an invite by its UUID (which is the share-token). Returns
     * undefined for unknown ids so the caller can render a generic
     * "invalid or expired" message without confirming whether the id was
     * ever issued. Includes the agency name so the accept-invite UI can
     * show "you're joining <Agency>" before the user types a password.
     */
    async findInviteById(id) {
        const row = await this.db('staff_invites as si')
            .leftJoin('agencies as a', 'a.id', 'si.agency_id')
            .where('si.id', id)
            .select('si.*', 'a.name as agency_name')
            .first();
        if (!row)
            return undefined;
        const base = this.mapInvite(row);
        return {
            ...base,
            acceptedAt: row.accepted_at instanceof Date
                ? row.accepted_at.toISOString()
                : row.accepted_at ?? null,
            agencyName: row.agency_name ?? null,
        };
    }
    /**
     * Mark an invite as redeemed. Idempotent only in the trivial sense —
     * if `accepted_at` is already non-null the caller should treat the
     * invite as already-used and refuse to create another user. The route
     * layer enforces single-use; this method just persists the marker.
     */
    async markInviteAccepted(id, acceptedUserId, acceptedAt) {
        await this.db('staff_invites').where({ id }).update({
            accepted_at: acceptedAt,
            accepted_user_id: acceptedUserId,
            status: 'accepted',
        });
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