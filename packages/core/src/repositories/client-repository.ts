import type { Knex } from 'knex';
import type { Client, Authorization } from '../domain/client.js';

export class ClientRepository {
  constructor(private readonly db: Knex) {}

  async createClient(agencyId: string, client: Client): Promise<Client> {
    const [inserted] = await this.db('clients').insert({
      id: client.id ?? crypto.randomUUID(),
      agency_id: agencyId,
      first_name: client.firstName,
      last_name: client.lastName,
      date_of_birth: client.dateOfBirth,
      medicaid_number: client.medicaidNumber
    }).returning('*');

    return this.mapRowToClient(inserted);
  }

  async getClients(agencyId: string): Promise<Client[]> {
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
  async getClientsForFamilyMember(userId: string, agencyId: string): Promise<Client[]> {
    const rows = await this.db('clients as c')
      .join('family_relationships as fr', 'fr.client_id', 'c.id')
      .where('fr.family_user_id', userId)
      .andWhere('c.agency_id', agencyId)
      .select('c.*');
    return rows.map((row) => this.mapRowToClient(row));
  }

  async createAuthorization(authorization: Authorization): Promise<Authorization> {
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

  async getAuthorizations(agencyId: string): Promise<Authorization[]> {
    const rows = await this.db('authorizations')
      .join('clients', 'authorizations.client_id', 'clients.id')
      .where('clients.agency_id', agencyId)
      .select('authorizations.*');
    return rows.map(row => this.mapRowToAuthorization(row));
  }

  private mapRowToClient(row: any): Client {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      dateOfBirth: row.date_of_birth instanceof Date ? row.date_of_birth.toISOString().split('T')[0] : row.date_of_birth,
      medicaidNumber: row.medicaid_number
    };
  }

  private mapRowToAuthorization(row: any): Authorization {
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
