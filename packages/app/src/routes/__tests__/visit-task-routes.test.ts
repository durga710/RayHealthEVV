import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

const visitId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const caregiverId = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const otherCaregiverId = 'dddddddd-dddd-4ddd-dddd-dddddddddddd';

beforeAll(() => setTestJwtSecret());

function mockVisit(caregiver = caregiverId) {
  vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
    getVisitByIdForAgency: vi.fn().mockResolvedValue({
      id: visitId,
      assignmentId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
      caregiverId: caregiver,
      clockInTime: '2026-07-12T14:00:00.000Z',
      clockInLocation: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
      status: 'pending',
    }),
  } as never));
}

function mockTaskRepository(overrides: Record<string, unknown> = {}) {
  const getForVisit = vi.fn().mockResolvedValue({
    plan: [{ taskCode: '122', taskLabel: 'Hygiene' }],
    completions: [],
  });
  const upsertBatch = vi.fn().mockResolvedValue([
    {
      id: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee',
      visitId,
      caregiverId,
      clientEventId: 'ffffffff-ffff-4fff-afff-ffffffffffff',
      taskCode: '122',
      taskLabel: 'Hygiene',
      status: 'performed',
      recordedAt: '2026-07-12T16:00:00.000Z',
    },
  ]);

  vi.spyOn(core as unknown as Record<string, unknown>, 'VisitTaskCompletionRepository').mockImplementation(
    () => ({ getForVisit, upsertBatch, ...overrides }),
  );
  return { getForVisit, upsertBatch };
}

describe('visit task completion routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the visit care plan and persisted completion state', async () => {
    mockVisit();
    const { getForVisit } = mockTaskRepository();

    const response = await request(createApp())
      .get(`/evv/visits/${visitId}/tasks`)
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`);

    expect(response.status).toBe(200);
    expect(response.body.plan).toEqual([{ taskCode: '122', taskLabel: 'Hygiene' }]);
    expect(getForVisit).toHaveBeenCalledWith(visitId, 'agency-1');
  });

  it('persists an idempotent completion batch and audits the write', async () => {
    mockVisit();
    const { upsertBatch } = mockTaskRepository();
    const auditCreate = vi.fn().mockResolvedValue({});
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: auditCreate } as never));

    const completion = {
      clientEventId: 'ffffffff-ffff-4fff-afff-ffffffffffff',
      taskCode: '122',
      taskLabel: 'Hygiene',
      status: 'performed',
    };
    const response = await request(createApp())
      .put(`/evv/visits/${visitId}/tasks`)
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
      .send({ completions: [completion] });

    expect(response.status).toBe(200);
    expect(upsertBatch).toHaveBeenCalledWith({
      agencyId: 'agency-1',
      visitId,
      caregiverId,
      completions: [completion],
    });
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      agencyId: 'agency-1',
      eventType: 'evv.tasks.completed',
      entityId: visitId,
    }));
  });

  it('rejects malformed completion data before writing', async () => {
    mockVisit();
    const { upsertBatch } = mockTaskRepository();

    const response = await request(createApp())
      .put(`/evv/visits/${visitId}/tasks`)
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
      .send({ completions: [{ clientEventId: 'bad', taskCode: '9999', taskLabel: '', status: 'done' }] });

    expect(response.status).toBe(400);
    expect(upsertBatch).not.toHaveBeenCalled();
  });

  it('does not reveal or update another caregiver visit', async () => {
    mockVisit(otherCaregiverId);
    const { upsertBatch } = mockTaskRepository();

    const response = await request(createApp())
      .put(`/evv/visits/${visitId}/tasks`)
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
      .send({
        completions: [{
          clientEventId: 'ffffffff-ffff-4fff-afff-ffffffffffff',
          taskCode: '122',
          taskLabel: 'Hygiene',
          status: 'performed',
        }],
      });

    expect(response.status).toBe(404);
    expect(upsertBatch).not.toHaveBeenCalled();
  });

  it('does not let a coordinator record caregiver task completion', async () => {
    mockVisit();
    const { upsertBatch } = mockTaskRepository();

    const response = await request(createApp())
      .put(`/evv/visits/${visitId}/tasks`)
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ completions: [] });

    expect(response.status).toBe(403);
    expect(upsertBatch).not.toHaveBeenCalled();
  });
});
