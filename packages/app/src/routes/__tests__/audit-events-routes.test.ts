import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

const sampleRow: core.AuditEvent = {
  id: '00000000-0000-4000-8000-0000000000b1',
  agencyId: '00000000-0000-4000-8000-0000000000b0',
  actorId: '00000000-0000-4000-8000-0000000000b2',
  actorType: 'user',
  eventType: 'phi.read',
  entityType: 'client',
  entityId: '00000000-0000-4000-8000-0000000000b3',
  outcome: 'success',
  payload: { resource: 'client-detail' },
  occurredAt: '2026-05-10T09:00:00.000Z',
  createdAt: '2026-05-10T09:00:00.500Z'
};

describe('GET /admin/audit-events', () => {
  it('returns rows + total for admins with audit.read', async () => {
    const agencyId = '00000000-0000-4000-8000-0000000000b0';
    const userId = '00000000-0000-4000-8000-0000000000b9';

    const list = vi.fn().mockResolvedValue({ rows: [sampleRow], total: 1 });

    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      function (this: unknown) {
        return { list } as unknown as core.AuditEventRepository;
      } as unknown as (db: unknown) => core.AuditEventRepository
    );

    const response = await request(createApp())
      .get('/admin/audit-events')
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      total: 1,
      limit: 50,
      offset: 0
    });
    expect(response.body.rows).toHaveLength(1);
    expect(response.body.rows[0]).toMatchObject({ eventType: 'phi.read' });
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId,
        limit: 50,
        offset: 0
      })
    );
  });

  it('forwards filters to the repository', async () => {
    const agencyId = '00000000-0000-4000-8000-0000000000c0';
    const userId = '00000000-0000-4000-8000-0000000000c9';
    const actorId = '00000000-0000-4000-8000-0000000000c2';

    const list = vi.fn().mockResolvedValue({ rows: [], total: 0 });

    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      function (this: unknown) {
        return { list } as unknown as core.AuditEventRepository;
      } as unknown as (db: unknown) => core.AuditEventRepository
    );

    const response = await request(createApp())
      .get('/admin/audit-events')
      .query({
        eventType: 'phi.export',
        actorId,
        outcome: 'success',
        from: '2026-05-01T00:00:00.000Z',
        to: '2026-05-15T00:00:00.000Z',
        limit: 25,
        offset: 50
      })
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ limit: 25, offset: 50, total: 0 });
    expect(list).toHaveBeenCalledWith({
      agencyId,
      eventType: 'phi.export',
      actorId,
      outcome: 'success',
      fromIso: '2026-05-01T00:00:00.000Z',
      toIso: '2026-05-15T00:00:00.000Z',
      limit: 25,
      offset: 50
    });
  });

  it('rejects limit > 200 with 400', async () => {
    const agencyId = '00000000-0000-4000-8000-0000000000d0';
    const userId = '00000000-0000-4000-8000-0000000000d9';

    const response = await request(createApp())
      .get('/admin/audit-events')
      .query({ limit: 5000 })
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid query parameters');
  });

  it('rejects an unknown eventType with 400', async () => {
    const agencyId = '00000000-0000-4000-8000-0000000000d1';
    const userId = '00000000-0000-4000-8000-0000000000d8';

    const response = await request(createApp())
      .get('/admin/audit-events')
      .query({ eventType: 'not-a-real-event' })
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(400);
  });

  it('rejects coordinators (no audit.read capability)', async () => {
    const agencyId = '00000000-0000-4000-8000-0000000000e0';
    const userId = '00000000-0000-4000-8000-0000000000e9';

    const response = await request(createApp())
      .get('/admin/audit-events')
      .set('Authorization', `Bearer ${makeToken('coordinator', agencyId, userId)}`);

    expect(response.status).toBe(403);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(createApp()).get('/admin/audit-events');
    expect(response.status).toBe(401);
  });
});
