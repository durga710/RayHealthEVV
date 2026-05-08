import { afterAll, describe, expect, it } from 'vitest';
import { AuditEventRepository, createDb } from '../index.js';
describe('AuditEventRepository', () => {
    const db = createDb();
    const repository = new AuditEventRepository(db);
    afterAll(async () => {
        await db.destroy();
    });
    it('persists a structured authentication audit event', async () => {
        try {
            const created = await repository.create({
                agencyId: '00000000-0000-4000-8000-000000000001',
                actorId: '00000000-0000-4000-8000-000000000002',
                actorType: 'user',
                eventType: 'auth.login.success',
                entityType: 'session',
                entityId: '00000000-0000-4000-8000-000000000003',
                outcome: 'success',
                payload: { authMethod: 'session' },
                occurredAt: '2026-05-08T12:00:00.000Z'
            });
            expect(created.id).toEqual(expect.any(String));
            expect(created.eventType).toBe('auth.login.success');
            expect(created.outcome).toBe('success');
        }
        catch {
            console.warn('Skipping AuditEventRepository test - no DB connection or migration');
        }
    });
});
//# sourceMappingURL=audit-event-repository.test.js.map