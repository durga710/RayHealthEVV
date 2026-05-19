import type { Knex } from 'knex';
import type { Agency, AgencyTheme } from '../domain/agency.js';

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

  /**
   * Update an agency's mutable fields (today: just `name`). Returns the
   * updated row, or null if the agency doesn't exist. Used by the admin
   * AgencySetupPage save action — previously a stub that didn't persist.
   */
  async findTheme(id: string): Promise<AgencyTheme | null> {
    const row = await this.db('agencies').select('features').where({ id }).first();
    if (!row) return null;
    const features: Record<string, unknown> = typeof row.features === 'string' ? JSON.parse(row.features) : row.features ?? {};
    return (features.theme as AgencyTheme) ?? null;
  }

  async updateName(id: string, name: string): Promise<Agency | null> {
    const trimmed = name.trim();
    if (!trimmed) return this.findById(id);
    const [row] = await this.db<AgencyRow>('agencies')
      .where({ id })
      .update({ name: trimmed, updated_at: this.db.fn.now() as unknown as Date })
      .returning('*');
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
