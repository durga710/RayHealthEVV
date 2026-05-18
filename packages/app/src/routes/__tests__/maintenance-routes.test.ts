import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());
afterEach(() => vi.restoreAllMocks());

const VISIT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const REQUEST_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const AGENCY_ID = 'agency-1';

function makeMaintenance(overrides: Partial<core.VisitMaintenance> = {}): core.VisitMaintenance {
  return {
    id: REQUEST_ID,
    visitId: VISIT_ID,
    requesterId: 'user-1',
    reason: 'GPS drift during visit',
    status: 'pending',
    ...overrides,
  };
}

function mockRepo(methods: Partial<core.VisitMaintenanceRepository>) {
  vi.spyOn(core, 'VisitMaintenanceRepository').mockImplementation(
    function MockRepo() {
      return methods as unknown as core.VisitMaintenanceRepository;
    } as unknown as typeof core.VisitMaintenanceRepository,
  );
}

describe('POST /maintenance/request-unlock', () => {
  it('creates a new unlock request and returns 201 with success envelope', async () => {
    const record = makeMaintenance();
    mockRepo({ requestUnlock: vi.fn().mockResolvedValue(record) });

    const response = await request(createApp())
      .post('/maintenance/request-unlock')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ visitId: VISIT_ID, reason: 'GPS drift during visit' });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.visitId).toBe(VISIT_ID);
    expect(response.body.data.status).toBe('pending');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const response = await request(createApp()).post('/maintenance/request-unlock').send({
      visitId: VISIT_ID,
      reason: 'test',
    });
    expect(response.status).toBe(401);
  });
});

describe('POST /maintenance/approve-unlock/:id', () => {
  it('approves an unlock request and returns the updated record', async () => {
    const approved = makeMaintenance({
      status: 'approved',
      adjustedStartTime: '2024-01-15T09:00:00.000Z',
      adjustedEndTime: '2024-01-15T11:00:00.000Z',
    });
    mockRepo({ approveUnlock: vi.fn().mockResolvedValue(approved) });

    const response = await request(createApp())
      .post(`/maintenance/approve-unlock/${REQUEST_ID}`)
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ adjustedTimes: { start: '2024-01-15T09:00:00.000Z', end: '2024-01-15T11:00:00.000Z' } });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('approved');
  });

  it('returns 404 when the unlock request does not exist', async () => {
    mockRepo({ approveUnlock: vi.fn().mockResolvedValue(null) });

    const response = await request(createApp())
      .post('/maintenance/approve-unlock/no-such-id')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ adjustedTimes: { start: '2024-01-15T09:00:00.000Z', end: '2024-01-15T11:00:00.000Z' } });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});

describe('POST /maintenance/reject-unlock/:id', () => {
  it('rejects an unlock request and returns the updated record', async () => {
    const rejected = makeMaintenance({ status: 'rejected' });
    mockRepo({ rejectUnlock: vi.fn().mockResolvedValue(rejected) });

    const response = await request(createApp())
      .post(`/maintenance/reject-unlock/${REQUEST_ID}`)
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ reason: 'Not a valid correction request' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('rejected');
  });

  it('returns 404 when the unlock request does not exist', async () => {
    mockRepo({ rejectUnlock: vi.fn().mockResolvedValue(null) });

    const response = await request(createApp())
      .post('/maintenance/reject-unlock/no-such-id')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({});

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});

describe('GET /maintenance/queue', () => {
  it('returns pending unlock requests for the agency', async () => {
    const pending = [makeMaintenance(), makeMaintenance({ id: 'cccc-2', visitId: 'dddd-2' })];
    mockRepo({ getPendingQueue: vi.fn().mockResolvedValue(pending) });

    const response = await request(createApp())
      .get('/maintenance/queue')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].status).toBe('pending');
  });

  it('returns empty array when there are no pending requests', async () => {
    mockRepo({ getPendingQueue: vi.fn().mockResolvedValue([]) });

    const response = await request(createApp())
      .get('/maintenance/queue')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([]);
  });
});

describe('GET /maintenance/history', () => {
  it('returns resolved (non-pending) records for the agency', async () => {
    const history = [
      makeMaintenance({ status: 'approved' }),
      makeMaintenance({ id: 'eeee-3', status: 'rejected' }),
    ];
    mockRepo({ getHistory: vi.fn().mockResolvedValue(history) });

    const response = await request(createApp())
      .get('/maintenance/history')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
  });
});

describe('GET /maintenance/visit/:visitId', () => {
  it('returns all maintenance records for a given visit', async () => {
    const records = [makeMaintenance(), makeMaintenance({ id: 'ffff-4', status: 'approved' })];
    const getByVisitId = vi.fn().mockResolvedValue(records);
    mockRepo({ getByVisitId });

    const response = await request(createApp())
      .get(`/maintenance/visit/${VISIT_ID}`)
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
    expect(getByVisitId).toHaveBeenCalledWith(VISIT_ID);
  });

  it('returns empty array when visit has no maintenance records', async () => {
    mockRepo({ getByVisitId: vi.fn().mockResolvedValue([]) });

    const response = await request(createApp())
      .get(`/maintenance/visit/${VISIT_ID}`)
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([]);
  });
});

describe('/api prefix', () => {
  it('maintenance queue is reachable via /api prefix', async () => {
    mockRepo({ getPendingQueue: vi.fn().mockResolvedValue([]) });

    const response = await request(createApp())
      .get('/api/maintenance/queue')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
