import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, ScheduleRepository } from '../index.js';

/**
 * Agency-scoped schedule read used by the audit packet route (Agent 06):
 * `getAssignmentScheduleForAgency` resolves scheduled start/end for one
 * assignment via assignments -> visit_templates -> clients.agency_id. The
 * audit packet route calls this with `visit.assignmentId`, which could in
 * principle reference an assignment from another tenant, this must return
 * null rather than that tenant's scheduled times.
 *
 * Skips (rather than fails) when no DB is reachable, matching this suite's
 * existing convention (see evv-exception-repository.test.ts,
 * visit-maintenance-tenant-isolation.test.ts).
 */
describe('ScheduleRepository.getAssignmentScheduleForAgency', () => {
  const db = createDb();
  const repo = new ScheduleRepository(db);
  let isConnected = false;

  let agencyAId: string;
  let agencyBId: string;
  let assignmentAId: string;

  beforeAll(async () => {
    try {
      await db.raw('select 1');
      isConnected = true;

      agencyAId = crypto.randomUUID();
      agencyBId = crypto.randomUUID();
      const caregiverAId = crypto.randomUUID();
      const clientAId = crypto.randomUUID();
      const visitTemplateAId = crypto.randomUUID();
      assignmentAId = crypto.randomUUID();

      await db('agencies').insert([
        { id: agencyAId, name: 'Agency A (schedule scoped-read test)', state: 'PA', operating_tracks: JSON.stringify(['personal-assistance']) },
        { id: agencyBId, name: 'Agency B (schedule scoped-read test)', state: 'PA', operating_tracks: JSON.stringify(['personal-assistance']) }
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
        name: 'Schedule scoped-read test template',
        tasks: JSON.stringify([])
      });
      await db('assignments').insert({
        id: assignmentAId,
        caregiver_id: caregiverAId,
        visit_template_id: visitTemplateAId,
        scheduled_start_time: '2026-06-01T14:00:00.000Z',
        scheduled_end_time: '2026-06-01T16:00:00.000Z'
      });
    } catch {
      console.warn('Skipping ScheduleRepository scoped-read test - no DB connection or migration');
    }
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('returns the scheduled start/end for the owning agency', async () => {
    if (!isConnected) return;
    const result = await repo.getAssignmentScheduleForAgency(assignmentAId, agencyAId);
    expect(result).toEqual({
      scheduledStartTime: '2026-06-01T14:00:00.000Z',
      scheduledEndTime: '2026-06-01T16:00:00.000Z'
    });
  });

  it('returns null for another agency instead of leaking the schedule', async () => {
    if (!isConnected) return;
    const result = await repo.getAssignmentScheduleForAgency(assignmentAId, agencyBId);
    expect(result).toBeNull();
  });
});
