import type { Knex } from 'knex';
import type { Caregiver, CaregiverCredential, StaffInvite } from '../domain/caregiver.js';
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

  async findById(id: string): Promise<Caregiver | undefined> {
    const row = await this.db('caregivers').where({ id }).first();
    return row ? this.mapCaregiver(row) : undefined;
  }

  async findByAgency(agencyId: string): Promise<Caregiver[]> {
    const rows = await this.db('caregivers').where({ agency_id: agencyId });
    return rows.map((r: Record<string, unknown>) => this.mapCaregiver(r));
  }

  async findByEmail(email: string): Promise<Caregiver | undefined> {
    const row = await this.db('caregivers').where({ email }).first();
    return row ? this.mapCaregiver(row) : undefined;
  }

  async updateStatus(id: string, status: 'active' | 'inactive' | 'suspended'): Promise<void> {
    await this.db('caregivers').where({ id }).update({ status });
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

  async getCredentials(caregiverId: string): Promise<CaregiverCredential[]> {
    const rows = await this.db('caregiver_credentials').where({ caregiver_id: caregiverId });
    return rows.map((r: Record<string, unknown>) => this.mapCredential(r));
  }

  async expireCredential(id: string): Promise<void> {
    await this.db('caregiver_credentials').where({ id }).update({ status: 'expired' });
  }

  async createInvite(invite: Omit<StaffInvite, 'id'>): Promise<StaffInvite> {
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

  private mapInvite(row: Record<string, unknown>): StaffInvite {
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
