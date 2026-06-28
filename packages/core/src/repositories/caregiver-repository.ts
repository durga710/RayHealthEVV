import type { Knex } from 'knex';
import type { Caregiver, CaregiverCredential, PersistedStaffInvite, StaffInvite } from '../domain/caregiver.js';
import { decryptCell, encryptCell } from '../security/cell-cipher.js';

export class CaregiverRepository {
  constructor(private readonly db: Knex) {}

  async create(data: Omit<Caregiver, 'id'>): Promise<Caregiver> {
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

  async findById(id: string, agencyId: string): Promise<Caregiver | undefined> {
    const row = await this.db('caregivers').where({ id, agency_id: agencyId }).first();
    return row ? this.mapCaregiver(row) : undefined;
  }

  async findByAgency(agencyId: string): Promise<Caregiver[]> {
    const rows = await this.db('caregivers').where({ agency_id: agencyId });
    return rows.map((r: Record<string, unknown>) => this.mapCaregiver(r));
  }

  async findByEmail(email: string, agencyId: string): Promise<Caregiver | undefined> {
    const row = await this.db('caregivers').where({ email, agency_id: agencyId }).first();
    return row ? this.mapCaregiver(row) : undefined;
  }

  async updateStatus(id: string, agencyId: string, status: 'active' | 'inactive' | 'terminated'): Promise<void> {
    const updated = await this.db('caregivers').where({ id, agency_id: agencyId }).update({ status });
    if (updated === 0) throw new Error('caregiver not found in agency');
  }

  /**
   * Set a caregiver's NPI (rendering-provider id for the 837 service line).
   * Stored encrypted via the cell cipher. Returns false if the caregiver is
   * not in the agency.
   */
  async updateNpi(id: string, agencyId: string, npi: string): Promise<boolean> {
    const updated = await this.db('caregivers')
      .where({ id, agency_id: agencyId })
      .update({ npi: encryptCell(npi) });
    return updated > 0;
  }

  async saveCredential(credential: Omit<CaregiverCredential, 'id'>): Promise<CaregiverCredential> {
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

  async getCredentials(caregiverId: string, agencyId: string): Promise<CaregiverCredential[]> {
    const rows = await this.db('caregiver_credentials as cc')
      .join('caregivers as c', 'c.id', 'cc.caregiver_id')
      .where({ 'cc.caregiver_id': caregiverId, 'c.agency_id': agencyId })
      .select('cc.*');
    return rows.map((r: Record<string, unknown>) => this.mapCredential(r));
  }

  async expireCredential(id: string, agencyId: string): Promise<void> {
    await this.db('caregiver_credentials as cc')
      .join('caregivers as c', 'c.id', 'cc.caregiver_id')
      .where({ 'cc.id': id, 'c.agency_id': agencyId })
      .update({ 'cc.status': 'expired' });
  }

  async createInvite(invite: Omit<StaffInvite, 'id'>): Promise<PersistedStaffInvite> {
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
  async findInviteById(
    id: string,
  ): Promise<(PersistedStaffInvite & { acceptedAt: string | null; agencyName: string | null }) | undefined> {
    const row = await this.db('staff_invites as si')
      .leftJoin('agencies as a', 'a.id', 'si.agency_id')
      .where('si.id', id)
      .select('si.*', 'a.name as agency_name')
      .first();
    if (!row) return undefined;
    const base = this.mapInvite(row);
    return {
      ...base,
      acceptedAt:
        row.accepted_at instanceof Date
          ? row.accepted_at.toISOString()
          : (row.accepted_at as string | null) ?? null,
      agencyName: (row.agency_name as string | null) ?? null,
    };
  }

  /**
   * Mark an invite as redeemed. Idempotent only in the trivial sense —
   * if `accepted_at` is already non-null the caller should treat the
   * invite as already-used and refuse to create another user. The route
   * layer enforces single-use; this method just persists the marker.
   */
  async markInviteAccepted(id: string, acceptedUserId: string, acceptedAt: string): Promise<void> {
    await this.db('staff_invites').where({ id }).update({
      accepted_at: acceptedAt,
      accepted_user_id: acceptedUserId,
      status: 'accepted',
    });
  }

  private mapCaregiver(row: Record<string, unknown>): Caregiver {
    return {
      id: row.id as string,
      agencyId: row.agency_id as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      email: row.email as string,
      phone: row.phone as string | undefined,
      npi: (decryptCell(row.npi as string | null | undefined) ?? undefined) as string | undefined,
      hireDate: row.hire_date instanceof Date
        ? row.hire_date.toISOString().split('T')[0]
        : row.hire_date as string | undefined,
      status: row.status as Caregiver['status'],
    };
  }

  private mapCredential(row: Record<string, unknown>): CaregiverCredential {
    return {
      id: row.id as string,
      caregiverId: row.caregiver_id as string,
      credentialType: row.credential_type as CaregiverCredential['credentialType'],
      status: row.status as CaregiverCredential['status'],
      expiresAt: row.expires_at instanceof Date
        ? row.expires_at.toISOString().split('T')[0]
        : row.expires_at as string,
      issuedAt: row.issued_at instanceof Date
        ? row.issued_at.toISOString().split('T')[0]
        : row.issued_at as string | undefined,
      notes: row.notes as string | undefined,
    };
  }

  private mapInvite(row: Record<string, unknown>): PersistedStaffInvite {
    return {
      id: row.id as string,
      agencyId: row.agency_id as string,
      email: row.email as string,
      role: row.role as StaffInvite['role'],
      status: row.status as StaffInvite['status'],
      invitedBy: row.invited_by as string,
      expiresAt: row.expires_at instanceof Date
        ? row.expires_at.toISOString()
        : row.expires_at as string,
    };
  }
}
