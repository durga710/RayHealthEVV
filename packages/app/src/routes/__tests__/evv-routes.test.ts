import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

const visitId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const assignmentId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const caregiverId = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const otherCaregiverId = 'dddddddd-dddd-4ddd-dddd-dddddddddddd';

beforeAll(() => setTestJwtSecret());

describe('evv routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requires a caregiver identity to clock out a visit', async () => {
    const mockUpdateVisit = vi.fn().mockResolvedValue({
      id: visitId,
      assignmentId,
      caregiverId,
      clockInTime: '2026-05-20T14:00:00.000Z',
      clockOutTime: '2026-05-20T16:00:00.000Z',
      clockInLocation: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
      clockOutLocation: { lat: 40.4407, lng: -79.996, accuracy: 12 },
      status: 'verified'
    });
    vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
      updateVisit: mockUpdateVisit
    } as any));

    const response = await request(createApp())
      .post(`/evv/clock-out/${visitId}`)
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ location: { lat: 40.4407, lng: -79.996, accuracy: 12 } });

    expect(response.status).toBe(403);
    expect(mockUpdateVisit).not.toHaveBeenCalled();
  });

  it('does not let caregivers clock out another caregiver visit', async () => {
    const mockGetVisitByIdForAgency = vi.fn().mockResolvedValue({
      id: visitId,
      assignmentId,
      caregiverId: otherCaregiverId,
      clockInTime: '2026-05-20T14:00:00.000Z',
      clockInLocation: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
      status: 'pending'
    });
    const mockUpdateVisit = vi.fn();
    vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
      getVisitByIdForAgency: mockGetVisitByIdForAgency,
      updateVisit: mockUpdateVisit
    } as any));

    const response = await request(createApp())
      .post(`/evv/clock-out/${visitId}`)
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
      .send({ location: { lat: 40.4407, lng: -79.996, accuracy: 12 } });

    expect(response.status).toBe(404);
    expect(mockUpdateVisit).not.toHaveBeenCalled();
  });

  it('rejects clock-in when the assignment authorization has an unsupported service code', async () => {
    const mockCreateVisit = vi.fn().mockResolvedValue({
      id: visitId,
      assignmentId,
      caregiverId,
      serviceCode: 'BAD',
      clockInTime: '2026-05-20T14:00:00.000Z',
      clockInLocation: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
      status: 'pending'
    });
    vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
      createVisit: mockCreateVisit
    } as any));
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
      getAssignmentForCaregiver: vi.fn().mockResolvedValue({
        id: assignmentId,
        caregiverId,
        visitTemplateId: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee',
        clientId: 'ffffffff-ffff-4fff-afff-ffffffffffff',
        serviceCode: 'BAD'
      })
    } as any));
    // The clock-in route now also fetches the client's geofence anchor
    // before service-code validation. Mock to fail-open (no geofence
    // registered) so this test stays focused on the service-code path.
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
      getClientGeofence: vi.fn().mockResolvedValue(undefined)
    } as any));

    const response = await request(createApp())
      .post('/evv/clock-in')
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
      .send({
        assignmentId,
        location: { lat: 40.4406, lng: -79.9959, accuracy: 10 }
      });

    expect(response.status).toBe(400);
    expect(mockCreateVisit).not.toHaveBeenCalled();
  });

  it('snapshots documented tasks and note onto the visit at clock-out', async () => {
    // No clientId on the open visit → geofence check is skipped, keeping this
    // test focused on the documentation path.
    const mockGetVisitByIdForAgency = vi.fn().mockResolvedValue({
      id: visitId,
      assignmentId,
      caregiverId,
      clockInTime: '2026-05-20T14:00:00.000Z',
      clockInLocation: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
      status: 'pending'
    });
    const mockUpdateVisit = vi.fn().mockImplementation((_id, _agency, patch) =>
      Promise.resolve({
        id: visitId,
        assignmentId,
        caregiverId,
        clockInTime: '2026-05-20T14:00:00.000Z',
        clockInLocation: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
        ...patch
      })
    );
    vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
      getVisitByIdForAgency: mockGetVisitByIdForAgency,
      updateVisit: mockUpdateVisit
    } as any));

    const response = await request(createApp())
      .post(`/evv/clock-out/${visitId}`)
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
      .send({
        location: { lat: 40.4407, lng: -79.996, accuracy: 12 },
        // '134' repeated to prove dedupe; snapshot resolves duty names.
        taskIds: ['134', '115', '134'],
        note: 'Client ate well and walked to the porch.'
      });

    expect(response.status).toBe(200);
    expect(mockUpdateVisit).toHaveBeenCalledWith(
      visitId,
      'agency-1',
      expect.objectContaining({
        tasks: [
          { id: '134', duty: 'Bathing' },
          { id: '115', duty: 'Meal-Preparation' }
        ],
        visitNote: 'Client ate well and walked to the porch.'
      })
    );
    expect(response.body.tasks).toHaveLength(2);
    expect(response.body.visitNote).toBe('Client ate well and walked to the porch.');
  });

  it('rejects unknown task codes at clock-out without closing the visit', async () => {
    const mockUpdateVisit = vi.fn();
    vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
      updateVisit: mockUpdateVisit
    } as any));

    const response = await request(createApp())
      .post(`/evv/clock-out/${visitId}`)
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
      .send({
        location: { lat: 40.4407, lng: -79.996, accuracy: 12 },
        taskIds: ['134', '999']
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('UNKNOWN_TASK_CODE');
    expect(mockUpdateVisit).not.toHaveBeenCalled();
  });

  it('stores the verification-of-service signature stamped with the punch time', async () => {
    const mockGetVisitByIdForAgency = vi.fn().mockResolvedValue({
      id: visitId,
      assignmentId,
      caregiverId,
      clockInTime: '2026-05-20T14:00:00.000Z',
      clockInLocation: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
      status: 'pending'
    });
    const mockUpdateVisit = vi.fn().mockImplementation((_id, _agency, patch) =>
      Promise.resolve({
        id: visitId, assignmentId, caregiverId,
        clockInTime: '2026-05-20T14:00:00.000Z',
        clockInLocation: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
        ...patch
      })
    );
    vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
      getVisitByIdForAgency: mockGetVisitByIdForAgency,
      updateVisit: mockUpdateVisit
    } as any));

    const response = await request(createApp())
      .post(`/evv/clock-out/${visitId}`)
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
      .send({
        location: { lat: 40.4407, lng: -79.996, accuracy: 12 },
        signature: {
          strokes: [[[10, 20], [30, 40], [50, 42]], [[60, 10], [80, 25]]],
          width: 320,
          height: 160,
          signerRole: 'client'
        }
      });

    expect(response.status).toBe(200);
    const patch = mockUpdateVisit.mock.calls[0][2];
    expect(patch.signature).toMatchObject({
      strokes: [[[10, 20], [30, 40], [50, 42]], [[60, 10], [80, 25]]],
      width: 320,
      height: 160,
      signerRole: 'client',
      signerName: null
    });
    // signedAt is stamped from the punch time, not client-supplied.
    expect(patch.signature.signedAt).toBe(patch.clockOutTime);
  });

  it('rejects a malformed signature at clock-out', async () => {
    const mockUpdateVisit = vi.fn();
    vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
      updateVisit: mockUpdateVisit
    } as any));

    const response = await request(createApp())
      .post(`/evv/clock-out/${visitId}`)
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
      .send({
        location: { lat: 40.4407, lng: -79.996, accuracy: 12 },
        signature: { strokes: [], width: 320, height: 160, signerRole: 'client' }
      });

    expect(response.status).toBe(400);
    expect(mockUpdateVisit).not.toHaveBeenCalled();
  });

  it('honors an in-window offline capturedAt at clock-in', async () => {
    const capturedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
    const mockCreateVisit = vi.fn().mockImplementation((v) => Promise.resolve({ ...v, id: visitId }));
    vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
      findOpenVisitForAssignment: vi.fn().mockResolvedValue(undefined),
      createVisit: mockCreateVisit
    } as any));
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
      getAssignmentForCaregiver: vi.fn().mockResolvedValue({
        id: assignmentId,
        caregiverId,
        clientId: 'ffffffff-ffff-4fff-afff-ffffffffffff',
        serviceCode: 'T1019'
      })
    } as any));
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
      getClientGeofence: vi.fn().mockResolvedValue(undefined)
    } as any));

    const response = await request(createApp())
      .post('/evv/clock-in')
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
      .send({
        assignmentId,
        location: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
        capturedAt
      });

    expect(response.status).toBe(201);
    expect(mockCreateVisit).toHaveBeenCalledWith(
      expect.objectContaining({ clockInTime: capturedAt })
    );
  });

  it('rejects a future capturedAt at clock-in', async () => {
    const mockCreateVisit = vi.fn();
    vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
      findOpenVisitForAssignment: vi.fn().mockResolvedValue(undefined),
      createVisit: mockCreateVisit
    } as any));
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
      getAssignmentForCaregiver: vi.fn().mockResolvedValue({
        id: assignmentId,
        caregiverId,
        clientId: 'ffffffff-ffff-4fff-afff-ffffffffffff',
        serviceCode: 'T1019'
      })
    } as any));
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
      getClientGeofence: vi.fn().mockResolvedValue(undefined)
    } as any));

    const response = await request(createApp())
      .post('/evv/clock-in')
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
      .send({
        assignmentId,
        location: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
        capturedAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min ahead
      });

    expect(response.status).toBe(400);
    expect(mockCreateVisit).not.toHaveBeenCalled();
  });

  it('honors an in-window capturedAt at clock-out and rejects one before clock-in', async () => {
    const clockInTime = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(); // 5h ago
    const capturedOut = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
    const mockGetVisitByIdForAgency = vi.fn().mockResolvedValue({
      id: visitId,
      assignmentId,
      caregiverId,
      clockInTime,
      clockInLocation: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
      status: 'pending'
    });
    const mockUpdateVisit = vi.fn().mockImplementation((_id, _agency, patch) =>
      Promise.resolve({ id: visitId, assignmentId, caregiverId, clockInTime, clockInLocation: { lat: 40.4406, lng: -79.9959, accuracy: 10 }, ...patch })
    );
    vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
      getVisitByIdForAgency: mockGetVisitByIdForAgency,
      updateVisit: mockUpdateVisit
    } as any));

    const token = makeToken('caregiver', 'agency-1', 'user-1', caregiverId);
    const good = await request(createApp())
      .post(`/evv/clock-out/${visitId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ location: { lat: 40.4407, lng: -79.996, accuracy: 12 }, capturedAt: capturedOut });
    expect(good.status).toBe(200);
    expect(mockUpdateVisit).toHaveBeenCalledWith(
      visitId,
      'agency-1',
      expect.objectContaining({ clockOutTime: capturedOut })
    );

    mockUpdateVisit.mockClear();
    const beforeClockIn = new Date(Date.parse(clockInTime) - 60 * 1000).toISOString();
    const bad = await request(createApp())
      .post(`/evv/clock-out/${visitId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ location: { lat: 40.4407, lng: -79.996, accuracy: 12 }, capturedAt: beforeClockIn });
    expect(bad.status).toBe(400);
    expect(mockUpdateVisit).not.toHaveBeenCalled();
  });

  it('returns an agency visit count via COUNT (no full fetch)', async () => {
    const countVisitsForAgency = vi.fn().mockResolvedValue(42);
    const getVisitsForAgency = vi.fn();
    vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
      countVisitsForAgency,
      getVisitsForAgency,
    } as any));

    const response = await request(createApp())
      .get('/evv/visits/count')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(42);
    expect(countVisitsForAgency).toHaveBeenCalledWith('agency-1');
    // Must NOT fall back to hauling every visit row.
    expect(getVisitsForAgency).not.toHaveBeenCalled();
  });
});
