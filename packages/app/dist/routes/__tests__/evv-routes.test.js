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
        }));
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
        }));
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
        }));
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
            getAssignmentForCaregiver: vi.fn().mockResolvedValue({
                id: assignmentId,
                caregiverId,
                visitTemplateId: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee',
                clientId: 'ffffffff-ffff-4fff-afff-ffffffffffff',
                serviceCode: 'BAD'
            })
        }));
        // The clock-in route now also fetches the client's geofence anchor
        // before service-code validation. Mock to fail-open (no geofence
        // registered) so this test stays focused on the service-code path.
        vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
            getClientGeofence: vi.fn().mockResolvedValue(undefined)
        }));
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
    it('returns an agency visit count via COUNT (no full fetch)', async () => {
        const countVisitsForAgency = vi.fn().mockResolvedValue(42);
        const getVisitsForAgency = vi.fn();
        vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
            countVisitsForAgency,
            getVisitsForAgency,
        }));
        const response = await request(createApp())
            .get('/evv/visits/count')
            .set('Authorization', `Bearer ${makeToken('admin')}`);
        expect(response.status).toBe(200);
        expect(response.body.count).toBe(42);
        expect(countVisitsForAgency).toHaveBeenCalledWith('agency-1');
        // Must NOT fall back to hauling every visit row.
        expect(getVisitsForAgency).not.toHaveBeenCalled();
    });
    it('uses client ids and the captured timestamp for an offline clock-in', async () => {
        const getVisitByClockInClientEvent = vi.fn().mockResolvedValue(null);
        const createVisit = vi.fn().mockImplementation(async (visit) => visit);
        vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
            getVisitByClockInClientEvent,
            createVisit,
        }));
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
            getAssignmentForCaregiver: vi.fn().mockResolvedValue({
                id: assignmentId,
                caregiverId,
                clientId: 'ffffffff-ffff-4fff-afff-ffffffffffff',
                serviceCode: 'T1019',
            }),
        }));
        vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
            getClientGeofence: vi.fn().mockResolvedValue(undefined),
        }));
        const occurredAt = new Date(Date.now() - 60000).toISOString();
        const eventId = 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee';
        const response = await request(createApp())
            .post('/evv/clock-in')
            .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
            .send({
            assignmentId,
            visitId,
            clientEventId: eventId,
            occurredAt,
            captureMode: 'offline',
            serviceCode: 'T1019',
            location: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
        });
        expect(response.status).toBe(201);
        expect(getVisitByClockInClientEvent).toHaveBeenCalledWith(eventId, 'agency-1', caregiverId);
        expect(createVisit).toHaveBeenCalledWith(expect.objectContaining({
            id: visitId,
            clockInClientEventId: eventId,
            clockInCaptureMode: 'offline',
            clockInTime: occurredAt,
        }));
    });
    it('returns the original visit for a repeated clock-in event', async () => {
        const existing = {
            id: visitId,
            assignmentId,
            caregiverId,
            clockInTime: '2026-07-12T18:15:00.000Z',
            clockInLocation: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
            status: 'pending',
        };
        const getVisitByClockInClientEvent = vi.fn().mockResolvedValue(existing);
        const createVisit = vi.fn();
        vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
            getVisitByClockInClientEvent,
            createVisit,
        }));
        const response = await request(createApp())
            .post('/evv/clock-in')
            .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
            .send({
            assignmentId,
            visitId,
            clientEventId: 'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee',
            occurredAt: new Date(Date.now() - 60000).toISOString(),
            captureMode: 'offline',
            serviceCode: 'T1019',
            location: { lat: 40.4406, lng: -79.9959, accuracy: 10 },
        });
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(visitId);
        expect(createVisit).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=evv-routes.test.js.map