import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';
beforeAll(() => setTestJwtSecret());
describe('assignment routes', () => {
    it('creates an assignment when the authorization and caregiver are valid', async () => {
        const mockCreateAssignment = vi.fn().mockResolvedValue({
            id: '123',
            caregiverId: 'caregiver-1',
            visitTemplateId: 'template-1'
        });
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
            createAssignment: mockCreateAssignment
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
});
//# sourceMappingURL=assignment-routes.test.js.map