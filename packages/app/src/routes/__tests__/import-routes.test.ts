import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

const CLIENTS_CSV =
  'external_id,first_name,last_name,date_of_birth\n' +
  'C-1,Ada,Lovelace,1990-12-10\n' +
  'C-2,Grace,Hopper,1985-01-02\n';

describe('import routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('serves a template CSV for a known entity', async () => {
    const res = await request(createApp())
      .get('/import/clients/template.csv')
      .set('Authorization', `Bearer ${makeToken('admin')}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('first_name');
    expect(res.text).toContain('external_id');
  });

  it('404s for an unknown entity', async () => {
    const res = await request(createApp())
      .get('/import/widgets/template.csv')
      .set('Authorization', `Bearer ${makeToken('admin')}`);
    expect(res.status).toBe(404);
  });

  it('previews a clients CSV without writing', async () => {
    const res = await request(createApp())
      .post('/import/clients/preview')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .set('content-type', 'text/csv')
      .send(CLIENTS_CSV);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ entity: 'clients', total: 2, okCount: 2, errorCount: 0 });
  });

  it('reports validation errors in preview', async () => {
    const res = await request(createApp())
      .post('/import/clients/preview')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .set('content-type', 'text/csv')
      .send('first_name,last_name,date_of_birth\n,Smith,bad-date\n');
    expect(res.status).toBe(200);
    expect(res.body.errorCount).toBe(1);
    expect(res.body.rows[0].errors.length).toBeGreaterThan(0);
  });

  it('commits a clean clients CSV via upsert', async () => {
    const upsertClientForImport = vi
      .fn()
      .mockResolvedValueOnce({ id: 'a', action: 'created' })
      .mockResolvedValueOnce({ id: 'b', action: 'updated' });
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
      upsertClientForImport,
    } as any));
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
      create: vi.fn().mockResolvedValue({}),
    } as any));

    // createApp's db is a stub; the route only uses db.transaction here.
    const app = createApp();
    app.set('db', {
      transaction: async (cb: (trx: unknown) => Promise<void>) => cb({}),
    });

    const res = await request(app)
      .post('/import/clients/commit')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .set('content-type', 'text/csv')
      .send(CLIENTS_CSV);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ entity: 'clients', created: 1, updated: 1, total: 2 });
    expect(upsertClientForImport).toHaveBeenCalledTimes(2);
  });

  it('refuses a commit with validation errors (422, nothing written)', async () => {
    const upsertClientForImport = vi.fn();
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({ upsertClientForImport } as any));

    const res = await request(createApp())
      .post('/import/clients/commit')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .set('content-type', 'text/csv')
      .send('first_name,last_name,date_of_birth\nAda,Lovelace,nope\n');

    expect(res.status).toBe(422);
    expect(upsertClientForImport).not.toHaveBeenCalled();
  });

  it('forbids coordinators from importing caregivers (no staff.write)', async () => {
    const res = await request(createApp())
      .post('/import/caregivers/preview')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .set('content-type', 'text/csv')
      .send('first_name,last_name,email\nA,B,a@b.com\n');
    expect(res.status).toBe(403);
  });

  describe('visits (EVV history)', () => {
    const VISITS_CSV =
      'external_id,client_external_id,caregiver_external_id,service_code,clock_in_time,clock_out_time,' +
      'clock_in_latitude,clock_in_longitude,status\n' +
      'V-1,C-1,G-1,T1019,2024-03-01T09:00:00Z,2024-03-01T11:00:00Z,40.44,-79.99,verified\n' +
      'V-2,C-1,G-1,S5125,2024-03-02T09:00:00Z,2024-03-02T10:30:00Z,,,\n';

    /** db stub: lookup tables resolve external ids; transaction passes through. */
    function makeDb(clients: Array<{ id: string; external_id: string }>, caregivers: Array<{ id: string; external_id: string }>) {
      const table = (rows: unknown[]) => ({
        where: () => ({ whereIn: () => ({ select: async () => rows }) }),
      });
      return Object.assign(
        (name: string) => (name === 'clients' ? table(clients) : table(caregivers)),
        { transaction: async (cb: (trx: unknown) => Promise<void>) => cb({}) },
      );
    }

    it('serves the visits template with the link columns', async () => {
      const res = await request(createApp())
        .get('/import/visits/template.csv')
        .set('Authorization', `Bearer ${makeToken('admin')}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('caregiver_external_id');
      expect(res.text).toContain('clock_in_time');
    });

    it('preview flags unresolved caregiver links as row errors', async () => {
      const app = createApp();
      app.set('db', makeDb([{ id: 'client-uuid', external_id: 'C-1' }], []));

      const res = await request(app)
        .post('/import/visits/preview')
        .set('Authorization', `Bearer ${makeToken('admin')}`)
        .set('content-type', 'text/csv')
        .send(VISITS_CSV);

      expect(res.status).toBe(200);
      expect(res.body.errorCount).toBe(2);
      expect(res.body.rows[0].errors.some((e: string) => e.includes("caregiver_external_id 'G-1'"))).toBe(true);
    });

    it('commits resolved visits insert-or-skip and reports skipped', async () => {
      const insertVisitForImport = vi
        .fn()
        .mockResolvedValueOnce({ action: 'created' })
        .mockResolvedValueOnce({ action: 'skipped' });
      vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({ insertVisitForImport } as any));
      vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
        create: vi.fn().mockResolvedValue({}),
      } as any));

      const app = createApp();
      app.set('db', makeDb(
        [{ id: 'client-uuid', external_id: 'C-1' }],
        [{ id: 'caregiver-uuid', external_id: 'G-1' }],
      ));

      const res = await request(app)
        .post('/import/visits/commit')
        .set('Authorization', `Bearer ${makeToken('admin')}`)
        .set('content-type', 'text/csv')
        .send(VISITS_CSV);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ entity: 'visits', created: 1, skipped: 1, updated: 0, total: 2 });
      expect(insertVisitForImport).toHaveBeenCalledTimes(2);
      expect(insertVisitForImport).toHaveBeenCalledWith(
        expect.objectContaining({
          externalId: 'V-1',
          clientId: 'client-uuid',
          caregiverId: 'caregiver-uuid',
          serviceCode: 'T1019',
          status: 'verified',
          // Canonical evvLocationSchema field names , downstream consumers
          // (Sandata mapper, exports, audit packets) read .lat/.lng.
          clockInLocation: { lat: 40.44, lng: -79.99, accuracy: 0, source: 'import' },
        }),
      );
      // GPS-less row stores the provenance marker only.
      expect(insertVisitForImport).toHaveBeenCalledWith(
        expect.objectContaining({ externalId: 'V-2', clockInLocation: { source: 'import' } }),
      );
    });

    it('forbids coordinators from importing visit history (billing.write is admin-only)', async () => {
      const res = await request(createApp())
        .post('/import/visits/preview')
        .set('Authorization', `Bearer ${makeToken('coordinator')}`)
        .set('content-type', 'text/csv')
        .send(VISITS_CSV);
      expect(res.status).toBe(403);
    });
  });
});
