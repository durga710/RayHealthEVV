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
});
