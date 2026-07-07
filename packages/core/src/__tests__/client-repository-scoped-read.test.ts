import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, ClientRepository } from '../index.js';

/**
 * Agency-scoped client reads used by the audit packet route (Agent 06):
 * `getClientNameForAgency` (minimum-necessary identity — id/firstName/
 * lastName only) and `getClientGeofence` (the EVV geofence anchor). Both are
 * joined into `GET /admin/audit-packet/:visitId` via `visit.clientId`, which
 * could in principle be a stale/foreign id — these methods must return
 * `undefined` rather than another agency's client data.
 *
 * Skips (rather than fails) when no DB is reachable, matching this suite's
 * existing convention (see evv-exception-repository.test.ts,
 * visit-maintenance-tenant-isolation.test.ts).
 */
describe('ClientRepository agency-scoped reads', () => {
  const db = createDb();
  const repo = new ClientRepository(db);
  let isConnected = false;

  let agencyAId: string;
  let agencyBId: string;
  let clientAId: string;

  beforeAll(async () => {
    try {
      await db.raw('select 1');
      isConnected = true;

      agencyAId = crypto.randomUUID();
      agencyBId = crypto.randomUUID();
      clientAId = crypto.randomUUID();

      await db('agencies').insert([
        { id: agencyAId, name: 'Agency A (client scoped-read test)', state: 'PA', operating_tracks: JSON.stringify(['personal-assistance']) },
        { id: agencyBId, name: 'Agency B (client scoped-read test)', state: 'PA', operating_tracks: JSON.stringify(['personal-assistance']) }
      ]);
      await db('clients').insert({
        id: clientAId,
        agency_id: agencyAId,
        first_name: 'Jamie',
        last_name: 'Client-A',
        date_of_birth: '1975-03-14',
        latitude: 40.2647,
        longitude: -76.8839,
        geofence_radius_m: 150
      });
    } catch {
      console.warn('Skipping ClientRepository scoped-read test - no DB connection or migration');
    }
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('getClientNameForAgency returns the name for the owning agency', async () => {
    if (!isConnected) return;
    const result = await repo.getClientNameForAgency(clientAId, agencyAId);
    expect(result).toEqual({ id: clientAId, firstName: 'Jamie', lastName: 'Client-A' });
  });

  it('getClientNameForAgency returns undefined for another agency instead of leaking the name', async () => {
    if (!isConnected) return;
    const result = await repo.getClientNameForAgency(clientAId, agencyBId);
    expect(result).toBeUndefined();
  });

  it('getClientGeofence returns the anchor for the owning agency', async () => {
    if (!isConnected) return;
    const result = await repo.getClientGeofence(clientAId, agencyAId);
    expect(result).toEqual({ latitude: 40.2647, longitude: -76.8839, geofenceRadiusM: 150 });
  });

  it('getClientGeofence returns undefined for another agency instead of leaking coordinates', async () => {
    if (!isConnected) return;
    const result = await repo.getClientGeofence(clientAId, agencyBId);
    expect(result).toBeUndefined();
  });
});
