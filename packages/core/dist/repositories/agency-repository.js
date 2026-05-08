export class AgencyRepository {
    constructor(db) {
        this.db = db;
    }
    async createAgency(agency) {
        const row = {
            id: agency.id ?? crypto.randomUUID(),
            name: agency.name,
            state: agency.state,
            operating_tracks: JSON.stringify(agency.operatingTracks),
            medicaid_provider_number: agency.medicaidProviderNumber
        };
        const [inserted] = await this.db('agencies').insert(row).returning('*');
        return this.mapRowToAgency(inserted);
    }
    async findById(id) {
        const row = await this.db('agencies').where({ id }).first();
        return row ? this.mapRowToAgency(row) : null;
    }
    mapRowToAgency(row) {
        return {
            id: row.id,
            name: row.name,
            state: row.state,
            operatingTracks: typeof row.operating_tracks === 'string' ? JSON.parse(row.operating_tracks) : row.operating_tracks,
            medicaidProviderNumber: row.medicaid_provider_number
        };
    }
}
//# sourceMappingURL=agency-repository.js.map