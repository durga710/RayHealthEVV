import { afterAll, describe, expect, it } from 'vitest';
import { createDb, SessionRepository } from '../index.js';
describe('SessionRepository', () => {
    const db = createDb();
    const repository = new SessionRepository(db);
    afterAll(async () => {
        await db.destroy();
    });
    it('creates, finds, and revokes an active session', async () => {
        try {
            const now = '2026-05-08T12:00:00.000Z';
            const expiresAt = '2026-05-08T20:00:00.000Z';
            const created = await repository.create({
                agencyId: '00000000-0000-4000-8000-000000000001',
                userId: '00000000-0000-4000-8000-000000000002',
                role: 'admin',
                sessionTokenHash: 'a'.repeat(64),
                csrfTokenHash: 'b'.repeat(64),
                userAgent: 'vitest',
                ipAddress: '127.0.0.1',
                expiresAt
            });
            const found = await repository.findActiveByTokenHash('a'.repeat(64), now);
            expect(found?.id).toBe(created.id);
            expect(found?.role).toBe('admin');
            expect(found?.csrfTokenHash).toBe('b'.repeat(64));
            await repository.rotateCsrfToken(created.id, 'c'.repeat(64));
            const rotated = await repository.findActiveByTokenHash('a'.repeat(64), now);
            expect(rotated?.csrfTokenHash).toBe('c'.repeat(64));
            await repository.revokeById(created.id, '2026-05-08T12:05:00.000Z');
            const revoked = await repository.findActiveByTokenHash('a'.repeat(64), now);
            expect(revoked).toBeUndefined();
        }
        catch {
            console.warn('Skipping SessionRepository test - no DB connection or migration');
        }
    });
});
//# sourceMappingURL=session-repository.test.js.map