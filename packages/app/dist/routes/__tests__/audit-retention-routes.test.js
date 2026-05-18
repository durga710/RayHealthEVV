import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';
beforeAll(() => setTestJwtSecret());
afterEach(() => {
    vi.restoreAllMocks();
});
describe('GET /admin/audit-retention/status', () => {
    it('returns retention stats + statutory floor for admins with audit.read', async () => {
        const agencyId = '00000000-0000-4000-8000-000000000091';
        const userId = '00000000-0000-4000-8000-000000000092';
        const getRetentionStats = vi.fn().mockResolvedValue({
            totalRows: 12345,
            oldestOccurredAt: '2024-01-15T00:00:00.000Z',
            eventsLast30Days: 3402,
            eventsApproachingSixYearLimit: 0
        });
        vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ getRetentionStats }));
        const response = await request(createApp())
            .get('/admin/audit-retention/status')
            .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            totalRows: 12345,
            oldestOccurredAt: '2024-01-15T00:00:00.000Z',
            eventsLast30Days: 3402,
            eventsApproachingSixYearLimit: 0,
            retentionFloorYears: 6,
            immutabilityTrigger: 'audit_events_block_mutation_trg'
        });
        expect(getRetentionStats).toHaveBeenCalledWith(agencyId);
    });
    it('rejects coordinators (no audit.read capability)', async () => {
        const agencyId = '00000000-0000-4000-8000-000000000093';
        const userId = '00000000-0000-4000-8000-000000000094';
        const response = await request(createApp())
            .get('/admin/audit-retention/status')
            .set('Authorization', `Bearer ${makeToken('coordinator', agencyId, userId)}`);
        expect(response.status).toBe(403);
    });
    it('rejects unauthenticated requests with 401', async () => {
        const response = await request(createApp()).get('/admin/audit-retention/status');
        expect(response.status).toBe(401);
    });
});
//# sourceMappingURL=audit-retention-routes.test.js.map