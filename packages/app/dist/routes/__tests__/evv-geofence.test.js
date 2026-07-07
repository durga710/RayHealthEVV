import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';
// Pennsylvania State Capitol — used as the "client address" anchor in
// these tests. New York City coordinates are far outside any reasonable
// geofence and are used to simulate an off-site clock-in attempt.
const PA_CAPITOL = { lat: 40.2647, lng: -76.8839, accuracy: 10 };
const NEW_YORK_CITY = { lat: 40.7589, lng: -73.9851, accuracy: 10 };
const visitId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const assignmentId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const caregiverId = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const clientId = 'ffffffff-ffff-4fff-afff-ffffffffffff';
beforeAll(() => setTestJwtSecret());
describe('evv geofence', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });
    function mockClientGeofence(geofence) {
        vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
            getClientGeofence: vi.fn().mockResolvedValue(geofence)
        }));
    }
    function mockAssignmentLookup() {
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
            getAssignmentForCaregiver: vi.fn().mockResolvedValue({
                id: assignmentId,
                caregiverId,
                visitTemplateId: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee',
                clientId,
                serviceCode: 'T1019'
            })
        }));
    }
    function mockAuditEventRepo() {
        vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
            create: vi.fn().mockResolvedValue({})
        }));
    }
    describe('clock-in', () => {
        it('allows clock-in within the geofence radius (201)', async () => {
            const mockCreateVisit = vi.fn().mockResolvedValue({
                id: visitId,
                assignmentId,
                caregiverId,
                clientId,
                serviceCode: 'T1019',
                clockInTime: '2026-05-20T14:00:00.000Z',
                clockInLocation: PA_CAPITOL,
                status: 'pending'
            });
            vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
                findOpenVisitForAssignment: vi.fn().mockResolvedValue(undefined),
                createVisit: mockCreateVisit
            }));
            mockAssignmentLookup();
            mockClientGeofence({
                latitude: PA_CAPITOL.lat,
                longitude: PA_CAPITOL.lng,
                geofenceRadiusM: 150
            });
            mockAuditEventRepo();
            const response = await request(createApp())
                .post('/evv/clock-in')
                .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
                .send({ assignmentId, location: PA_CAPITOL, serviceCode: 'T1019' });
            expect(response.status).toBe(201);
            expect(mockCreateVisit).toHaveBeenCalled();
        });
        it('rejects clock-in outside the geofence radius with 422 GEOFENCE_OUT_OF_BOUNDS', async () => {
            const mockCreateVisit = vi.fn();
            vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
                findOpenVisitForAssignment: vi.fn().mockResolvedValue(undefined),
                createVisit: mockCreateVisit
            }));
            mockAssignmentLookup();
            mockClientGeofence({
                latitude: PA_CAPITOL.lat,
                longitude: PA_CAPITOL.lng,
                geofenceRadiusM: 150
            });
            const auditCreate = vi.fn().mockResolvedValue({});
            vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
                create: auditCreate
            }));
            const response = await request(createApp())
                .post('/evv/clock-in')
                .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
                .send({ assignmentId, location: NEW_YORK_CITY, serviceCode: 'T1019' });
            expect(response.status).toBe(422);
            expect(response.body.code).toBe('GEOFENCE_OUT_OF_BOUNDS');
            expect(response.body.allowedM).toBe(150);
            expect(response.body.distanceM).toBeGreaterThan(150);
            expect(mockCreateVisit).not.toHaveBeenCalled();
            expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
                eventType: 'permission.denied',
                payload: expect.objectContaining({ reason: 'geofence' })
            }));
        });
        it('fails open when client has no registered latitude (201)', async () => {
            const mockCreateVisit = vi.fn().mockResolvedValue({
                id: visitId,
                assignmentId,
                caregiverId,
                clientId,
                serviceCode: 'T1019',
                clockInTime: '2026-05-20T14:00:00.000Z',
                clockInLocation: NEW_YORK_CITY,
                status: 'pending'
            });
            vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
                findOpenVisitForAssignment: vi.fn().mockResolvedValue(undefined),
                createVisit: mockCreateVisit
            }));
            mockAssignmentLookup();
            mockClientGeofence({ latitude: null, longitude: null, geofenceRadiusM: 150 });
            mockAuditEventRepo();
            const response = await request(createApp())
                .post('/evv/clock-in')
                .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
                .send({ assignmentId, location: NEW_YORK_CITY, serviceCode: 'T1019' });
            expect(response.status).toBe(201);
            expect(mockCreateVisit).toHaveBeenCalled();
        });
    });
    describe('clock-out', () => {
        function existingVisit() {
            return vi.fn().mockResolvedValue({
                id: visitId,
                assignmentId,
                caregiverId,
                clientId,
                clockInTime: '2026-05-20T14:00:00.000Z',
                clockInLocation: PA_CAPITOL,
                status: 'pending'
            });
        }
        it('allows clock-out within the geofence radius', async () => {
            const mockUpdateVisit = vi.fn().mockResolvedValue({
                id: visitId,
                assignmentId,
                caregiverId,
                clientId,
                clockInTime: '2026-05-20T14:00:00.000Z',
                clockOutTime: '2026-05-20T16:00:00.000Z',
                clockInLocation: PA_CAPITOL,
                clockOutLocation: PA_CAPITOL,
                status: 'verified'
            });
            vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
                getVisitByIdForAgency: existingVisit(),
                updateVisit: mockUpdateVisit
            }));
            mockClientGeofence({
                latitude: PA_CAPITOL.lat,
                longitude: PA_CAPITOL.lng,
                geofenceRadiusM: 150
            });
            mockAuditEventRepo();
            const response = await request(createApp())
                .post(`/evv/clock-out/${visitId}`)
                .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
                .send({ location: PA_CAPITOL });
            expect(response.status).toBe(200);
            expect(mockUpdateVisit).toHaveBeenCalled();
        });
        it('rejects clock-out outside the geofence radius with 422 GEOFENCE_OUT_OF_BOUNDS', async () => {
            const mockUpdateVisit = vi.fn();
            vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
                getVisitByIdForAgency: existingVisit(),
                updateVisit: mockUpdateVisit
            }));
            mockClientGeofence({
                latitude: PA_CAPITOL.lat,
                longitude: PA_CAPITOL.lng,
                geofenceRadiusM: 150
            });
            const auditCreate = vi.fn().mockResolvedValue({});
            vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
                create: auditCreate
            }));
            const response = await request(createApp())
                .post(`/evv/clock-out/${visitId}`)
                .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
                .send({ location: NEW_YORK_CITY });
            expect(response.status).toBe(422);
            expect(response.body.code).toBe('GEOFENCE_OUT_OF_BOUNDS');
            expect(response.body.distanceM).toBeGreaterThan(150);
            expect(mockUpdateVisit).not.toHaveBeenCalled();
            expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
                eventType: 'permission.denied',
                entityType: 'evv.clock-out'
            }));
        });
        it('fails open at clock-out when client has no registered latitude', async () => {
            const mockUpdateVisit = vi.fn().mockResolvedValue({
                id: visitId,
                assignmentId,
                caregiverId,
                clientId,
                clockInTime: '2026-05-20T14:00:00.000Z',
                clockOutTime: '2026-05-20T16:00:00.000Z',
                clockInLocation: PA_CAPITOL,
                clockOutLocation: NEW_YORK_CITY,
                status: 'verified'
            });
            vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
                getVisitByIdForAgency: existingVisit(),
                updateVisit: mockUpdateVisit
            }));
            mockClientGeofence({ latitude: null, longitude: null, geofenceRadiusM: 150 });
            mockAuditEventRepo();
            const response = await request(createApp())
                .post(`/evv/clock-out/${visitId}`)
                .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', caregiverId)}`)
                .send({ location: NEW_YORK_CITY });
            expect(response.status).toBe(200);
            expect(mockUpdateVisit).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=evv-geofence.test.js.map