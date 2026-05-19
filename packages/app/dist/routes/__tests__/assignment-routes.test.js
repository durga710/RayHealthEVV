import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';
beforeAll(() => setTestJwtSecret());
describe('assignment routes', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });
    it('creates an assignment when the authorization and caregiver are valid', async () => {
        const mockCreateAssignment = vi.fn().mockResolvedValue({
            id: '123',
            caregiverId: 'caregiver-1',
            visitTemplateId: 'template-1'
        });
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
            createAssignment: mockCreateAssignment
        }));
        // The route now verifies caregiver belongs to the agency before creating.
        vi.spyOn(core, 'CaregiverRepository').mockImplementation(() => ({
            findById: vi.fn().mockResolvedValue({ id: 'caregiver-1', agencyId: 'agency-id', status: 'active' })
        }));
        const response = await request(createApp())
            .post('/assignments')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send({
            clientId: 'client-1',
            caregiverId: 'caregiver-1',
            visitTemplateId: 'template-1',
            authorizationId: 'auth-1',
            visitDate: '2026-05-20'
        });
        expect(response.status).toBe(201);
        expect(mockCreateAssignment).toHaveBeenCalled();
    });
    it('forbids caregivers from creating assignments', async () => {
        const mockCreateAssignment = vi.fn();
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
            createAssignment: mockCreateAssignment
        }));
        const response = await request(createApp())
            .post('/assignments')
            .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', 'caregiver-1')}`)
            .send({
            caregiverId: 'caregiver-2',
            visitTemplateId: 'template-1',
            visitDate: '2026-05-20'
        });
        expect(response.status).toBe(403);
        expect(mockCreateAssignment).not.toHaveBeenCalled();
    });
    it('rejects assignment creation without an explicit visit template', async () => {
        const mockCreateAssignment = vi.fn().mockResolvedValue({
            id: '123',
            caregiverId: 'caregiver-1',
            visitTemplateId: '00000000-0000-0000-0000-000000000000'
        });
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
            createAssignment: mockCreateAssignment
        }));
        const response = await request(createApp())
            .post('/assignments')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send({
            caregiverId: 'caregiver-1',
            visitDate: '2026-05-20'
        });
        expect(response.status).toBe(400);
        expect(mockCreateAssignment).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=assignment-routes.test.js.map