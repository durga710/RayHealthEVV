import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, EvvExceptionRepository } from '../index.js';

/**
 * Agency-scoped exception read (Agent 06 audit packet). `findExceptionsByVisitForAgency`
 * joins evv_exceptions -> evv_visits -> caregivers.agency_id, the same
 * authorization pattern documented on this repository (see the NOTE above
 * the deleted unscoped findByVisit). A visit id from another tenant must
 * return [] rather than that tenant's exceptions.
 *
 * Skips (rather than fails) when no DB is reachable, matching this suite's
 * existing convention (see repository-roundtrip.test.ts, db-schema.test.ts).
 */
describe('EvvExceptionRepository.findExceptionsByVisitForAgency', () => {
  const db = createDb();
  const repo = new EvvExceptionRepository(db);
  let isConnected = false;

  let agencyAId: string;
  let agencyBId: string;
  let visitAId: string;

  beforeAll(async () => {
    try {
      await db.raw('select 1');
      isConnected = true;

      agencyAId = crypto.randomUUID();
      agencyBId = crypto.randomUUID();
      const caregiverAId = crypto.randomUUID();
      const visitTemplateAId = crypto.randomUUID();
      const assignmentAId = crypto.randomUUID();
      visitAId = crypto.randomUUID();

      await db('agencies').insert([
        { id: agencyAId, name: 'Agency A (exception scoped-read test)', state: 'PA', operating_tracks: JSON.stringify(['personal-assistance']) },
        { id: agencyBId, name: 'Agency B (exception scoped-read test)', state: 'PA', operating_tracks: JSON.stringify(['personal-assistance']) }
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
        id: crypto.randomUUID(),
        agency_id: agencyAId,
        first_name: 'Test',
        last_name: 'Client-A',
        date_of_birth: '1980-01-01'
      });
      await db('visit_templates').insert({
        id: visitTemplateAId,
        client_id: (await db('clients').where({ agency_id: agencyAId }).first('id')).id,
        name: 'Exception scoped-read test template',
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
        status: 'flagged'
      });
      await db('evv_exceptions').insert({
        id: crypto.randomUUID(),
        visit_id: visitAId,
        exception_type: 'late-clock-in',
        reason: 'Traffic delay'
      });
    } catch {
      console.warn('Skipping EvvExceptionRepository scoped-read test - no DB connection or migration');
    }
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('returns the exception for the owning agency', async () => {
    if (!isConnected) return;
    const rows = await repo.findExceptionsByVisitForAgency(visitAId, agencyAId);
    expect(rows).toHaveLength(1);
    expect(rows[0].visitId).toBe(visitAId);
    expect(rows[0].exceptionType).toBe('late-clock-in');
  });

  it('returns [] for another agency instead of leaking the exception', async () => {
    if (!isConnected) return;
    const rows = await repo.findExceptionsByVisitForAgency(visitAId, agencyBId);
    expect(rows).toEqual([]);
  });
});
