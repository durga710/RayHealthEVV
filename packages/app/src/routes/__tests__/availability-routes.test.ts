import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());
afterEach(() => vi.restoreAllMocks());

const agencyId = '00000000-0000-4000-8000-00000000a001';
const userId = '00000000-0000-4000-8000-00000000a002';
const caregiverId = '00000000-0000-4000-8000-00000000a003';
const requestId = '00000000-0000-4000-8000-00000000a004';

function mockRepo(overrides: Record<string, unknown>) {
  vi.spyOn(core, 'AvailabilityRepository').mockImplementation(
    () => overrides as unknown as core.AvailabilityRepository,
  );
}

const caregiverAuth = () => `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId)}`;
const adminAuth = () => `Bearer ${makeToken('admin', agencyId, userId)}`;

describe('PUT /availability', () => {
  it('replaces the whole weekly pattern for the calling caregiver', async () => {
    const replaceAvailability = vi.fn().mockResolvedValue([]);
    mockRepo({ replaceAvailability });

    const res = await request(createApp())
      .put('/availability')
      .set('Authorization', caregiverAuth())
      .send({ slots: [{ dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }] });

    expect(res.status).toBe(200);
    expect(replaceAvailability).toHaveBeenCalledWith(caregiverId, agencyId, [
      { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
    ]);
  });

  it('accepts an empty pattern, which clears availability', async () => {
    const replaceAvailability = vi.fn().mockResolvedValue([]);
    mockRepo({ replaceAvailability });

    const res = await request(createApp())
      .put('/availability')
      .set('Authorization', caregiverAuth())
      .send({ slots: [] });

    expect(res.status).toBe(200);
    expect(replaceAvailability).toHaveBeenCalledWith(caregiverId, agencyId, []);
  });

  it('rejects a window that ends before it starts', async () => {
    const replaceAvailability = vi.fn();
    mockRepo({ replaceAvailability });

    const res = await request(createApp())
      .put('/availability')
      .set('Authorization', caregiverAuth())
      .send({ slots: [{ dayOfWeek: 2, startTime: '17:00', endTime: '09:00' }] });

    expect(res.status).toBe(400);
    expect(replaceAvailability).not.toHaveBeenCalled();
  });

  it('rejects a malformed time or weekday', async () => {
    mockRepo({ replaceAvailability: vi.fn() });

    expect(
      (await request(createApp()).put('/availability').set('Authorization', caregiverAuth())
        .send({ slots: [{ dayOfWeek: 2, startTime: '9:00', endTime: '17:00' }] })).status,
    ).toBe(400);
    expect(
      (await request(createApp()).put('/availability').set('Authorization', caregiverAuth())
        .send({ slots: [{ dayOfWeek: 7, startTime: '09:00', endTime: '17:00' }] })).status,
    ).toBe(400);
  });

  it('is caregiver-only', async () => {
    mockRepo({ replaceAvailability: vi.fn() });
    const res = await request(createApp())
      .put('/availability')
      .set('Authorization', adminAuth())
      .send({ slots: [] });
    expect(res.status).toBe(403);
  });
});

describe('POST /availability/time-off', () => {
  it('creates a request for the calling caregiver', async () => {
    const createTimeOff = vi.fn().mockResolvedValue({ id: requestId });
    mockRepo({ createTimeOff });

    const res = await request(createApp())
      .post('/availability/time-off')
      .set('Authorization', caregiverAuth())
      .send({ startDate: '2026-09-01', endDate: '2026-09-03', reason: 'Family' });

    expect(res.status).toBe(201);
    expect(createTimeOff).toHaveBeenCalledWith({
      agencyId,
      caregiverId,
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      reason: 'Family',
    });
  });

  it('accepts a single-day request', async () => {
    const createTimeOff = vi.fn().mockResolvedValue({ id: requestId });
    mockRepo({ createTimeOff });

    const res = await request(createApp())
      .post('/availability/time-off')
      .set('Authorization', caregiverAuth())
      .send({ startDate: '2026-09-01', endDate: '2026-09-01' });

    expect(res.status).toBe(201);
  });

  it('rejects an inverted range', async () => {
    const createTimeOff = vi.fn();
    mockRepo({ createTimeOff });

    const res = await request(createApp())
      .post('/availability/time-off')
      .set('Authorization', caregiverAuth())
      .send({ startDate: '2026-09-05', endDate: '2026-09-01' });

    expect(res.status).toBe(400);
    expect(createTimeOff).not.toHaveBeenCalled();
  });
});

describe('PATCH /availability/time-off/:id/review', () => {
  it('lets staff approve and notifies the caregiver', async () => {
    const reviewTimeOff = vi
      .fn()
      .mockResolvedValue({ id: requestId, caregiverId, status: 'approved' });
    mockRepo({ reviewTimeOff });

    const res = await request(createApp())
      .patch(`/availability/time-off/${requestId}/review`)
      .set('Authorization', adminAuth())
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(reviewTimeOff).toHaveBeenCalledWith(requestId, agencyId, 'approved', userId, null);
  });

  it('will not let a caregiver approve their own time off', async () => {
    const reviewTimeOff = vi.fn();
    mockRepo({ reviewTimeOff });

    const res = await request(createApp())
      .patch(`/availability/time-off/${requestId}/review`)
      .set('Authorization', caregiverAuth())
      .send({ status: 'approved' });

    expect(res.status).toBe(403);
    expect(reviewTimeOff).not.toHaveBeenCalled();
  });

  it('404s on an already-answered request', async () => {
    // Only 'requested' rows match, so a second reviewer cannot overturn the
    // first answer.
    mockRepo({ reviewTimeOff: vi.fn().mockResolvedValue(null) });

    const res = await request(createApp())
      .patch(`/availability/time-off/${requestId}/review`)
      .set('Authorization', adminAuth())
      .send({ status: 'denied' });

    expect(res.status).toBe(404);
  });
});

describe('GET /availability/time-off', () => {
  it('gives a caregiver only their own requests', async () => {
    const listTimeOffForCaregiver = vi.fn().mockResolvedValue([]);
    const listTimeOffForAgency = vi.fn().mockResolvedValue([]);
    mockRepo({ listTimeOffForCaregiver, listTimeOffForAgency });

    await request(createApp())
      .get('/availability/time-off')
      .set('Authorization', caregiverAuth());

    expect(listTimeOffForCaregiver).toHaveBeenCalledWith(caregiverId, agencyId);
    expect(listTimeOffForAgency).not.toHaveBeenCalled();
  });

  it('gives staff the agency queue', async () => {
    const listTimeOffForCaregiver = vi.fn().mockResolvedValue([]);
    const listTimeOffForAgency = vi.fn().mockResolvedValue([]);
    mockRepo({ listTimeOffForCaregiver, listTimeOffForAgency });

    await request(createApp())
      .get('/availability/time-off?status=requested')
      .set('Authorization', adminAuth());

    expect(listTimeOffForAgency).toHaveBeenCalledWith(agencyId, { status: 'requested' });
  });
});

describe('DELETE /availability/time-off/:id', () => {
  it('cancels the caregiver own request', async () => {
    const cancelOwnTimeOff = vi.fn().mockResolvedValue(true);
    mockRepo({ cancelOwnTimeOff });

    const res = await request(createApp())
      .delete(`/availability/time-off/${requestId}`)
      .set('Authorization', caregiverAuth());

    expect(res.status).toBe(204);
    expect(cancelOwnTimeOff).toHaveBeenCalledWith(requestId, caregiverId, agencyId);
  });

  it('404s when there is nothing cancellable', async () => {
    mockRepo({ cancelOwnTimeOff: vi.fn().mockResolvedValue(false) });

    const res = await request(createApp())
      .delete(`/availability/time-off/${requestId}`)
      .set('Authorization', caregiverAuth());

    expect(res.status).toBe(404);
  });
});

describe('approved time off gates scheduling', () => {
  /** Minimal mocks for the assignment create path, plus a leave calendar. */
  function mockAssignmentDeps(approvedLeave: unknown) {
    const createAssignment = vi.fn().mockResolvedValue({ id: 'a-1', caregiverId, visitTemplateId: 't-1' });
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
      createAssignment,
      getTemplateClient: vi.fn().mockResolvedValue({ clientId: 'client-1' }),
      getCaregiverScheduleForConflict: vi.fn().mockResolvedValue([]),
    } as unknown as core.ScheduleRepository));
    vi.spyOn(core, 'CaregiverRepository').mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue({ id: caregiverId, status: 'active' }),
      getCredentials: vi.fn().mockResolvedValue([]),
    } as unknown as core.CaregiverRepository));
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
      getAuthorizations: vi.fn().mockResolvedValue([]),
    } as unknown as core.ClientRepository));
    vi.spyOn(core, 'ClaimRepository').mockImplementation(() => ({
      getBilledLineUnits: vi.fn().mockResolvedValue([]),
    } as unknown as core.ClaimRepository));
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
      create: vi.fn().mockResolvedValue({}),
    } as unknown as core.AuditEventRepository));
    mockRepo({
      findApprovedTimeOffOn: vi.fn().mockResolvedValue(approvedLeave),
      listAvailability: vi.fn().mockResolvedValue([]),
    });
    return createAssignment;
  }

  it('refuses to book a caregiver over their approved leave', async () => {
    const createAssignment = mockAssignmentDeps({
      id: requestId,
      startDate: '2026-09-01',
      endDate: '2026-09-05',
      reason: 'Surgery',
    });

    const res = await request(createApp())
      .post('/assignments')
      .set('Authorization', adminAuth())
      .send({ caregiverId, visitTemplateId: 't-1', visitDate: '2026-09-02' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SCHEDULE_CONFLICT');
    // The reason may name a medical situation and must not reach the response.
    expect(JSON.stringify(res.body)).not.toContain('Surgery');
    expect(createAssignment).not.toHaveBeenCalled();
  });

  it('books normally when there is no approved leave that day', async () => {
    const createAssignment = mockAssignmentDeps(null);

    const res = await request(createApp())
      .post('/assignments')
      .set('Authorization', adminAuth())
      .send({ caregiverId, visitTemplateId: 't-1', visitDate: '2026-09-02' });

    expect(res.status).toBe(201);
    expect(createAssignment).toHaveBeenCalled();
  });

  it('warns but still books outside declared availability', async () => {
    // Availability is a preference, not a contract.
    const createAssignment = vi.fn().mockResolvedValue({ id: 'a-1', caregiverId, visitTemplateId: 't-1' });
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
      createAssignment,
      getTemplateClient: vi.fn().mockResolvedValue({ clientId: 'client-1' }),
      getCaregiverScheduleForConflict: vi.fn().mockResolvedValue([]),
    } as unknown as core.ScheduleRepository));
    vi.spyOn(core, 'CaregiverRepository').mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue({ id: caregiverId, status: 'active' }),
      getCredentials: vi.fn().mockResolvedValue([]),
    } as unknown as core.CaregiverRepository));
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
      getAuthorizations: vi.fn().mockResolvedValue([]),
    } as unknown as core.ClientRepository));
    vi.spyOn(core, 'ClaimRepository').mockImplementation(() => ({
      getBilledLineUnits: vi.fn().mockResolvedValue([]),
    } as unknown as core.ClaimRepository));
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
      create: vi.fn().mockResolvedValue({}),
    } as unknown as core.AuditEventRepository));
    mockRepo({
      findApprovedTimeOffOn: vi.fn().mockResolvedValue(null),
      // Only Mondays; 2026-09-02 is a Wednesday.
      listAvailability: vi.fn().mockResolvedValue([
        { id: 's1', caregiverId, dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      ]),
    });

    const res = await request(createApp())
      .post('/assignments')
      .set('Authorization', adminAuth())
      .send({ caregiverId, visitTemplateId: 't-1', visitDate: '2026-09-02' });

    expect(res.status).toBe(201);
    expect(createAssignment).toHaveBeenCalled();
    expect(String(res.body.warnings)).toContain('Wednesday');
  });
});
