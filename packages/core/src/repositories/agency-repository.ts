import type { Knex } from 'knex';
import type { Agency } from '../domain/agency.js';

export interface AgencyRow {
  id: string;
  name: string;
  state: string;
  operating_tracks: string;
  medicaid_provider_number?: string;
  created_at?: Date;
  updated_at?: Date;
}

export class AgencyRepository {
  constructor(private readonly db: Knex) {}

  async createAgency(agency: Agency): Promise<Agency> {
    const row: AgencyRow = {
      id: agency.id ?? crypto.randomUUID(),
      name: agency.name,
      state: agency.state,
      operating_tracks: JSON.stringify(agency.operatingTracks),
      medicaid_provider_number: agency.medicaidProviderNumber
    };

    const [inserted] = await this.db<AgencyRow>('agencies').insert(row).returning('*');
    return this.mapRowToAgency(inserted);
  }

  async findById(id: string): Promise<Agency | null> {
    const row = await this.db<AgencyRow>('agencies').where({ id }).first();
    return row ? this.mapRowToAgency(row) : null;
  }

  private mapRowToAgency(row: AgencyRow): Agency {
    return {
      id: row.id,
      name: row.name,
      state: row.state as 'PA',
      operatingTracks: typeof row.operating_tracks === 'string' ? JSON.parse(row.operating_tracks) : row.operating_tracks,
      medicaidProviderNumber: row.medicaid_provider_number
    };
  }
}
