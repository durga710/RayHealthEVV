import { decryptCell, encryptCell } from '../security/cell-cipher.js';
export class ClientRepository {
    constructor(db) {
        this.db = db;
    }
    async createClient(agencyId, client) {
        const [inserted] = await this.db('clients').insert({
            id: client.id ?? crypto.randomUUID(),
            agency_id: agencyId,
            first_name: client.firstName,
            last_name: client.lastName,
            date_of_birth: client.dateOfBirth,
            // Encrypt PHI Medicaid ID at write. Output is `v1:<base64>` ciphertext;
            // mapRowToClient decrypts on the way out.
            medicaid_number: encryptCell(client.medicaidNumber)
        }).returning('*');
        return this.mapRowToClient(inserted);
    }
    async getClients(agencyId) {
        const rows = await this.db('clients').where({ agency_id: agencyId });
        return rows.map(row => this.mapRowToClient(row));
    }
    /**
     * Clients reachable by a family-role user via the `family_relationships`
     * link table. The family role's `client.read` capability used to surface
     * every client in the agency; this scopes it to the explicit relationships
     * a coordinator has approved.
     *
     * Also agency-scoped so a stale relationship row from before a client was
     * reassigned cannot leak across tenants.
     */
    async getClientsForFamilyMember(userId, agencyId) {
        const rows = await this.db('clients as c')
            .join('family_relationships as fr', 'fr.client_id', 'c.id')
            .where('fr.family_user_id', userId)
            .andWhere('c.agency_id', agencyId)
            .select('c.*');
        return rows.map((row) => this.mapRowToClient(row));
    }
    async createAuthorization(authorization) {
        const [inserted] = await this.db('authorizations').insert({
            id: authorization.id ?? crypto.randomUUID(),
            client_id: authorization.clientId,
            payer_id: authorization.payerId,
            units_authorized: authorization.unitsAuthorized,
            service_code: authorization.serviceCode,
            start_date: authorization.startDate,
            end_date: authorization.endDate
        }).returning('*');
        return this.mapRowToAuthorization(inserted);
    }
    async getAuthorizations(agencyId) {
        const rows = await this.db('authorizations')
            .join('clients', 'authorizations.client_id', 'clients.id')
            .where('clients.agency_id', agencyId)
            .select('authorizations.*');
        return rows.map(row => this.mapRowToAuthorization(row));
    }
    mapRowToClient(row) {
        return {
            id: row.id,
            firstName: row.first_name,
            lastName: row.last_name,
            dateOfBirth: row.date_of_birth instanceof Date ? row.date_of_birth.toISOString().split('T')[0] : row.date_of_birth,
            // Decrypt at read. Legacy plaintext values round-trip; v1: ciphertext
            // returns the original Medicaid ID. Throws if ENCRYPTION_KEY is missing.
            medicaidNumber: decryptCell(row.medicaid_number) ?? undefined
        };
    }
    mapRowToAuthorization(row) {
        return {
            id: row.id,
            clientId: row.client_id,
            payerId: row.payer_id,
            unitsAuthorized: Number(row.units_authorized),
            serviceCode: row.service_code,
            startDate: row.start_date instanceof Date ? row.start_date.toISOString().split('T')[0] : row.start_date,
            endDate: row.end_date instanceof Date ? row.end_date.toISOString().split('T')[0] : row.end_date
        };
    }
}
//# sourceMappingURL=client-repository.js.map