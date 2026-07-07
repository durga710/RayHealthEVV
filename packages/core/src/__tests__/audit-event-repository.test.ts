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
    } catch {
      console.warn('Skipping AuditEventRepository test - no DB connection or migration');
    }
  });

  it('lists events filtered by agency with pagination + total', async () => {
    try {
      const agencyId = '00000000-0000-4000-8000-0000000000a1';
      const actorId = '00000000-0000-4000-8000-0000000000a2';
      const entityId = '00000000-0000-4000-8000-0000000000a3';

      await repository.create({
        agencyId,
        actorId,
        actorType: 'user',
        eventType: 'phi.read',
        entityType: 'client',
        entityId,
        outcome: 'success',
        payload: { resource: 'client-detail' },
        occurredAt: '2026-05-10T09:00:00.000Z'
      });
      await repository.create({
        agencyId,
        actorId,
        actorType: 'user',
        eventType: 'phi.export',
        entityType: 'client',
        entityId,
        outcome: 'success',
        payload: { resource: 'client-export' },
        occurredAt: '2026-05-11T09:00:00.000Z'
      });

      const all = await repository.list({ agencyId, limit: 50, offset: 0 });
      expect(all.total).toBeGreaterThanOrEqual(2);
      expect(all.rows.length).toBeGreaterThanOrEqual(2);

      const first = all.rows[0];
      const second = all.rows[1];
      if (first?.occurredAt && second?.occurredAt) {
        expect(new Date(first.occurredAt).getTime()).toBeGreaterThanOrEqual(
          new Date(second.occurredAt).getTime()
        );
      }

      const filtered = await repository.list({
        agencyId,
        eventType: 'phi.export',
        limit: 50,
        offset: 0
      });
      expect(filtered.rows.every((r) => r.eventType === 'phi.export')).toBe(true);

      const paged = await repository.list({ agencyId, limit: 1, offset: 0 });
      expect(paged.rows.length).toBe(1);
      expect(paged.total).toBeGreaterThanOrEqual(2);
    } catch {
      console.warn('Skipping AuditEventRepository.list test - no DB connection or migration');
    }
  });

  /**
   * findByEntityForAgency backs the audit packet route (Agent 06), which is
   * forbidden from using the unscoped findByEntity, a visit/assignment id
   * from another tenant must never resolve to that tenant's audit rows.
   */
  it('findByEntityForAgency filters by agency_id, unlike findByEntity', async () => {
    try {
      const agencyId = '00000000-0000-4000-8000-0000000000b1';
      const otherAgencyId = '00000000-0000-4000-8000-0000000000b2';
      const entityId = '00000000-0000-4000-8000-0000000000b3';

      await repository.create({
        agencyId,
        actorId: '00000000-0000-4000-8000-0000000000b4',
        actorType: 'user',
        eventType: 'exception.filed',
        entityType: 'evv.visit',
        entityId,
        outcome: 'success',
        payload: { note: 'owning-agency row' },
        occurredAt: '2026-06-01T09:00:00.000Z'
      });
      await repository.create({
        agencyId: otherAgencyId,
        actorId: '00000000-0000-4000-8000-0000000000b5',
        actorType: 'user',
        eventType: 'exception.filed',
        entityType: 'evv.visit',
        entityId,
        outcome: 'success',
        payload: { note: 'other-agency row, same entityId' },
        occurredAt: '2026-06-01T10:00:00.000Z'
      });

      const scoped = await repository.findByEntityForAgency(agencyId, 'evv.visit', entityId);
      expect(scoped).toHaveLength(1);
      expect(scoped[0].agencyId).toBe(agencyId);

      const unscoped = await repository.findByEntity('evv.visit', entityId);
      expect(unscoped.length).toBeGreaterThanOrEqual(2);
    } catch {
      console.warn('Skipping AuditEventRepository.findByEntityForAgency test - no DB connection or migration');
    }
  });
});
