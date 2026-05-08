import type { Knex } from 'knex';
import type { Client, Authorization } from '../domain/client.js';
export declare class ClientRepository {
    private readonly db;
    constructor(db: Knex);
    createClient(agencyId: string, client: Client): Promise<Client>;
    getClients(agencyId: string): Promise<Client[]>;
    /**
     * Clients reachable by a family-role user via the `family_relationships`
     * link table. The family role's `client.read` capability used to surface
     * every client in the agency; this scopes it to the explicit relationships
     * a coordinator has approved.
     *
     * Also agency-scoped so a stale relationship row from before a client was
     * reassigned cannot leak across tenants.
     */
    getClientsForFamilyMember(userId: string, agencyId: string): Promise<Client[]>;
    createAuthorization(authorization: Authorization): Promise<Authorization>;
    getAuthorizations(agencyId: string): Promise<Authorization[]>;
    private mapRowToClient;
    private mapRowToAuthorization;
}
//# sourceMappingURL=client-repository.d.ts.map