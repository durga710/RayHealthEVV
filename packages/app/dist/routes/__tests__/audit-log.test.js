import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';
beforeAll(() => setTestJwtSecret());
afterEach(() => {
    vi.restoreAllMocks();
});
describe('audit logging middleware', () => {
    it('persists a structured audit event for protected write requests', async () => {
        const createAuditEvent = vi.fn().mockResolvedValue({});
        vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: createAuditEvent }));
        const response = await request(createApp())
            .post('/invites')
            .set('Authorization', `Bearer ${makeToken('admin')}`)
            .send({ email: 'caregiver@keystone.example', role: 'caregiver' });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(response.status).toBe(201);
        expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'phi.create',
            outcome: 'success',
            payload: expect.objectContaining({
                method: 'POST',
                path: '/invites',
                authMethod: 'bearer'
            })
        }));
    });
});
//# sourceMappingURL=audit-log.test.js.map