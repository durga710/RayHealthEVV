import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, VisitMaintenanceRepository } from '../index.js';
/**
 * Regression test for the cross-tenant IDOR fixed in
 * VisitMaintenanceRepository: a coordinator/admin in one agency must not be
 * able to request or approve a visit correction against another agency's
 * visit, even when they know (or guess) the visit/maintenance-record id.
 *
 * Skips (rather than fails) when no DB is reachable, matching this suite's
 * existing convention (see repository-roundtrip.test.ts, db-schema.test.ts).
 */
describe('VisitMaintenanceRepository tenant isolation', () => {
    const db = createDb();
    const repo = new VisitMaintenanceRepository(db);
    let isConnected = false;
    let agencyAId;
    let agencyBId;
    let visitAId;
    beforeAll(async () => {
        try {
            await db.raw('select 1');
            isConnected = true;
            agencyAId = crypto.randomUUID();
            agencyBId = crypto.randomUUID();
            const caregiverAId = crypto.randomUUID();
            const clientAId = crypto.randomUUID();
            const visitTemplateAId = crypto.randomUUID();
            const assignmentAId = crypto.randomUUID();
            visitAId = crypto.randomUUID();
            await db('agencies').insert([
                { id: agencyAId, name: 'Agency A (tenant-isolation test)', state: 'PA', operating_tracks: JSON.stringify(['personal-assistance']) },
                { id: agencyBId, name: 'Agency B (tenant-isolation test)', state: 'PA', operating_tracks: JSON.stringify(['personal-assistance']) }
            ]);
            await db('caregivers').insert({
                id: caregiverAId,
                agency_id: agencyAId,
                first_name: 'Test',
                last_name: 'Caregiver-A',
                email: `caregiver-a-${caregiverAId}@example.test`,
                status: 'active'
            });
            await db('clients').insert({
                id: clientAId,
                agency_id: agencyAId,
                first_name: 'Test',
                last_name: 'Client-A',
                date_of_birth: '1980-01-01'
            });
            await db('visit_templates').insert({
                id: visitTemplateAId,
                client_id: clientAId,
                name: 'Tenant isolation test template',
                tasks: JSON.stringify([])
            });
            await db('assignments').insert({
                id: assignmentAId,
                caregiver_id: caregiverAId,
                visit_template_id: visitTemplateAId
            });
            await db('evv_visits').insert({
                id: visitAId,
                assignment_id: assignmentAId,
                caregiver_id: caregiverAId,
                clock_in_time: new Date().toISOString(),
                clock_in_location: JSON.stringify({ lat: 40.0, lng: -75.0, accuracy: 10 }),
                status: 'verified'
            });
        }
        catch {
            console.warn('Skipping VisitMaintenanceRepository tenant isolation test - no DB connection or migration');
        }
    });
    afterAll(async () => {
        await db.destroy();
    });
    it('rejects requestUnlock for a visit owned by another agency', async () => {
        if (!isConnected)
            return;
        await expect(repo.requestUnlock({ visitId: visitAId, requesterId: crypto.randomUUID(), reason: 'cross-tenant attempt', status: 'pending' }, agencyBId)).rejects.toThrow();
    });
    it('allows requestUnlock for the owning agency and sets agency_id on the row', async () => {
        if (!isConnected)
            return;
        const created = await repo.requestUnlock({ visitId: visitAId, requesterId: crypto.randomUUID(), reason: 'same-tenant request', status: 'pending' }, agencyAId);
        expect(created.visitId).toBe(visitAId);
        expect(created.agencyId).toBe(agencyAId);
    });
    it('rejects approveUnlock from a different agency and returns null instead of leaking existence', async () => {
        if (!isConnected)
            return;
        const created = await repo.requestUnlock({ visitId: visitAId, requesterId: crypto.randomUUID(), reason: 'for approve-unlock test', status: 'pending' }, agencyAId);
        const crossTenantAttempt = await repo.approveUnlock(created.id, agencyBId, {
            start: new Date().toISOString(),
            end: new Date().toISOString()
        });
        expect(crossTenantAttempt).toBeNull();
        const sameTenantApproval = await repo.approveUnlock(created.id, agencyAId, {
            start: new Date().toISOString(),
            end: new Date().toISOString()
        });
        expect(sameTenantApproval?.status).toBe('approved');
    });
});
//# sourceMappingURL=visit-maintenance-tenant-isolation.test.js.map