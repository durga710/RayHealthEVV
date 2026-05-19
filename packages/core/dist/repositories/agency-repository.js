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
    /**
     * Update an agency's mutable fields (today: just `name`). Returns the
     * updated row, or null if the agency doesn't exist. Used by the admin
     * AgencySetupPage save action — previously a stub that didn't persist.
     */
    async findAll() {
        const rows = await this.db('agencies').select('*').orderBy('name');
        return rows.map((r) => this.mapRowToAgency(r));
    }
    async findTheme(id) {
        const row = await this.db('agencies').select('features').where({ id }).first();
        if (!row)
            return null;
        const features = typeof row.features === 'string' ? JSON.parse(row.features) : row.features ?? {};
        return features.theme ?? null;
    }
    async updateName(id, name) {
        const trimmed = name.trim();
        if (!trimmed)
            return this.findById(id);
        const [row] = await this.db('agencies')
            .where({ id })
            .update({ name: trimmed, updated_at: this.db.fn.now() })
            .returning('*');
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