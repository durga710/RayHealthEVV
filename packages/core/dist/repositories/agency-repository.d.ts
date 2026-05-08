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
export declare class AgencyRepository {
    private readonly db;
    constructor(db: Knex);
    createAgency(agency: Agency): Promise<Agency>;
    findById(id: string): Promise<Agency | null>;
    private mapRowToAgency;
}
//# sourceMappingURL=agency-repository.d.ts.map