import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';
beforeAll(() => setTestJwtSecret());
afterEach(() => vi.restoreAllMocks());
const agencyId = '00000000-0000-4000-8000-0000000000d1';
const userId = '00000000-0000-4000-8000-0000000000d2';
const caregiverId = '00000000-0000-4000-8000-0000000000d3';
const clientId = '00000000-0000-4000-8000-0000000000d4';
const assignmentId = '00000000-0000-4000-8000-0000000000d5';
describe('POST /templates — client ownership (finding #8)', () => {
    it('404s a client that does not belong to the caller agency, without creating', async () => {
        const clientBelongsToAgency = vi.fn().mockResolvedValue(false);
        const createTemplate = vi.fn();
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({ clientBelongsToAgency, createTemplate }));
        const res = await request(createApp())
            .post('/templates')
            .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`)
            .send({ clientId, name: 'Morning visit', tasks: [] });
        expect(res.status).toBe(404);
        expect(clientBelongsToAgency).toHaveBeenCalledWith(clientId, agencyId);
        expect(createTemplate).not.toHaveBeenCalled();
    });
    it('creates the template when the client is owned by the agency', async () => {
        const clientBelongsToAgency = vi.fn().mockResolvedValue(true);
        const createTemplate = vi.fn().mockResolvedValue({ id: 't1', clientId, name: 'Morning visit', tasks: [] });
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({ clientBelongsToAgency, createTemplate }));
        const res = await request(createApp())
            .post('/templates')
            .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`)
            .send({ clientId, name: 'Morning visit', tasks: [] });
        expect(res.status).toBe(201);
        expect(createTemplate).toHaveBeenCalled();
    });
});
describe('POST /evv/clock-in — concurrent open-visit guard (finding #9)', () => {
    it('409s when an open visit already exists for the assignment', async () => {
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
            getAssignmentForCaregiver: vi.fn().mockResolvedValue({
                id: assignmentId,
                caregiverId,
                clientId,
                serviceCode: 'T1019',
            }),
        }));
        vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({ getClientGeofence: vi.fn().mockResolvedValue(null) }));
        const createVisit = vi.fn();
        vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({
            findOpenVisitForAssignment: vi.fn().mockResolvedValue({ id: 'open-visit', assignmentId }),
            createVisit,
        }));
        const res = await request(createApp())
            .post('/evv/clock-in')
            .set('Authorization', `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId)}`)
            .send({ assignmentId, serviceCode: 'T1019', location: { lat: 40.44, lng: -79.99, accuracy: 10 } });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('VISIT_ALREADY_OPEN');
        expect(createVisit).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=template-clockin-guard-routes.test.js.map