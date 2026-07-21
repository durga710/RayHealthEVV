import { createHash, randomUUID } from 'node:crypto';
import knexFactory, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AUDIT_DEFENSE_PACKET_COLUMNS,
  ComplianceEngineRepository,
  auditPacketRowToCsv,
} from '../repositories/compliance-engine-repository.js';
import * as schema from '../migrations/schema.js';
import * as extendVisitMaintenance from '../migrations/2026-05-11-extend-visit-maintenance.js';
import * as backfillVisitMaintenanceAgencyId from '../migrations/2026-06-30-backfill-visit-maintenance-agency-id.js';
import * as addUserAgencies from '../migrations/2026-07-01-add-user-agencies.js';
import * as addOpenVisitUniqueIndex from '../migrations/2026-07-06-add-open-visit-unique-index.js';
import * as addVisitDocumentation from '../migrations/2026-07-08-add-visit-documentation.js';
import * as addVisitSignature from '../migrations/2026-07-09-add-visit-signature.js';
import * as addVisitTaskCompletions from '../migrations/2026-07-12-add-visit-task-completions.js';
import * as addOfflineEvvMetadata from '../migrations/2026-07-12-add-offline-evv-metadata.js';

/**
 * Integration tests for the Compliance Engine SQL layer, the queries the
 * route tests mock away. They need a real Postgres because the queries lean
 * on Postgres-only features (interval arithmetic, ::date casts,
 * COUNT(*) FILTER) that in-memory fakes such as pg-mem cannot execute.
 *
 * Gated on TEST_DATABASE_URL so the suite is skipped when no disposable
 * database is available. CI provides one via a postgres service container;
 * locally, `docker compose up -d postgres` and
 * `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/rayhealth`
 * runs them. Never point this at a shared or production database: the suite
 * writes fixture rows (it never deletes, and every row carries fresh UUIDs,
 * but it is still test data).
 */
const testDbUrl = process.env.TEST_DATABASE_URL;

/** Runs the same ordered migration list as src/migrations/runner.ts. */
async function migrate(db: Knex): Promise<void> {
  await schema.up(db);
  await extendVisitMaintenance.up(db);
  await backfillVisitMaintenanceAgencyId.up(db);
  await addUserAgencies.up(db);
  await addOpenVisitUniqueIndex.up(db);
  await addVisitDocumentation.up(db);
  await addVisitSignature.up(db);
  await addVisitTaskCompletions.up(db);
  await addOfflineEvvMetadata.up(db);
}

interface Fixture {
  agencyId: string;
  clientId: string;
  caregiverId: string;
  templateId: string;
  assignmentId: string;
}

describe.skipIf(!testDbUrl)('ComplianceEngineRepository (integration)', () => {
  let db: Knex;
  let repo: ComplianceEngineRepository;

  // Generous timeout: the migration list runs dozens of hasTable/hasColumn
  // round-trips, which adds up against a remote or cold-starting database.
  beforeAll(async () => {
    db = knexFactory({ client: 'pg', connection: testDbUrl });
    await migrate(db);
    repo = new ComplianceEngineRepository(db);
  }, 120_000);

  afterAll(async () => {
    await db?.destroy();
  });

  /** Seed one agency with a client, caregiver, template, and assignment. */
  async function seedFixture(): Promise<Fixture> {
    const agencyId = randomUUID();
    const clientId = randomUUID();
    const caregiverId = randomUUID();
    const templateId = randomUUID();
    const assignmentId = randomUUID();
    await db('agencies').insert({
      id: agencyId,
      name: `Test Agency ${agencyId.slice(0, 8)}`,
      operating_tracks: JSON.stringify(['personal-assistance']),
    });
    await db('clients').insert({
      id: clientId,
      agency_id: agencyId,
      first_name: 'Test',
      last_name: 'Client',
      date_of_birth: '1950-01-01',
    });
    await db('caregivers').insert({
      id: caregiverId,
      agency_id: agencyId,
      first_name: 'Test',
      last_name: 'Caregiver',
      email: `cg-${agencyId.slice(0, 13)}@test.invalid`,
    });
    await db('visit_templates').insert({
      id: templateId,
      client_id: clientId,
      name: 'Template',
      tasks: JSON.stringify([]),
    });
    await db('assignments').insert({
      id: assignmentId,
      caregiver_id: caregiverId,
      visit_template_id: templateId,
    });
    return { agencyId, clientId, caregiverId, templateId, assignmentId };
  }

  /** Extra assignment on the fixture's template; the schema allows only one
   *  open visit per assignment, so each open visit needs its own. */
  async function seedAssignment(f: Fixture): Promise<string> {
    const id = randomUUID();
    await db('assignments').insert({
      id,
      caregiver_id: f.caregiverId,
      visit_template_id: f.templateId,
    });
    return id;
  }

  async function seedVisit(
    f: Fixture,
    v: {
      clockIn: string;
      clockOut?: string | null;
      status?: string;
      serviceCode?: string | null;
      clientId?: string | null;
      assignmentId?: string;
    },
  ): Promise<string> {
    const id = randomUUID();
    await db('evv_visits').insert({
      id,
      assignment_id: v.assignmentId ?? f.assignmentId,
      caregiver_id: f.caregiverId,
      service_code: v.serviceCode === undefined ? 'T1019' : v.serviceCode,
      client_id: v.clientId === undefined ? f.clientId : v.clientId,
      clock_in_time: v.clockIn,
      clock_out_time: v.clockOut ?? null,
      clock_in_location: JSON.stringify({ lat: 40.44, lng: -79.99, accuracyM: 10 }),
      status: v.status ?? 'verified',
    });
    return id;
  }

  async function seedAuthorization(
    f: Fixture,
    a: { serviceCode: string; unitsAuthorized: number; startDate: string; endDate: string },
  ): Promise<string> {
    const id = randomUUID();
    await db('authorizations').insert({
      id,
      client_id: f.clientId,
      payer_id: 'PA-MA',
      units_authorized: a.unitsAuthorized,
      service_code: a.serviceCode,
      start_date: a.startDate,
      end_date: a.endDate,
    });
    return id;
  }

  describe('listAuthorizations unit math', () => {
    it('converts 15-minute-code visit durations to units and scopes by code, window, and client', async () => {
      const f = await seedFixture();
      const authId = await seedAuthorization(f, {
        serviceCode: 'T1019',
        unitsAuthorized: 100,
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      });

      // Counted: 2h verified (8 units) + 90min flagged-but-completed (6 units).
      await seedVisit(f, { clockIn: '2026-07-02T09:00:00Z', clockOut: '2026-07-02T11:00:00Z' });
      await seedVisit(f, {
        clockIn: '2026-07-03T09:00:00Z',
        clockOut: '2026-07-03T10:30:00Z',
        status: 'flagged',
      });
      // Excluded: different service code, outside window, and still open.
      await seedVisit(f, {
        clockIn: '2026-07-04T09:00:00Z',
        clockOut: '2026-07-04T11:00:00Z',
        serviceCode: 'S5125',
      });
      await seedVisit(f, { clockIn: '2026-06-15T09:00:00Z', clockOut: '2026-06-15T11:00:00Z' });
      await seedVisit(f, { clockIn: '2026-07-05T09:00:00Z', clockOut: null });

      const page = await repo.listAuthorizations(f.agencyId, { asOf: '2026-07-15' });
      const row = page.rows.find((r) => r.id === authId);
      expect(row).toBeDefined();
      expect(row?.unitsAuthorized).toBe(100);
      expect(row?.unitsUsed).toBe(14);
      expect(row?.unitsRemaining).toBe(86);
    });

    it('falls back through assignment and template when the visit has no client_id snapshot', async () => {
      const f = await seedFixture();
      const authId = await seedAuthorization(f, {
        serviceCode: 'T1019',
        unitsAuthorized: 40,
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      });
      // 1h visit with a NULL client_id snapshot: reachable only via
      // assignment -> visit_template -> client.
      await seedVisit(f, {
        clockIn: '2026-07-02T09:00:00Z',
        clockOut: '2026-07-02T10:00:00Z',
        clientId: null,
      });

      const page = await repo.listAuthorizations(f.agencyId, { asOf: '2026-07-15' });
      const row = page.rows.find((r) => r.id === authId);
      expect(row?.unitsUsed).toBe(4);
      expect(row?.unitsRemaining).toBe(36);
    });

    it('counts per-visit codes (T1021) as one unit per completed visit regardless of duration', async () => {
      const f = await seedFixture();
      const authId = await seedAuthorization(f, {
        serviceCode: 'T1021',
        unitsAuthorized: 10,
        startDate: '2026-07-01',
        endDate: '2026-07-31',
      });
      await seedVisit(f, {
        clockIn: '2026-07-02T09:00:00Z',
        clockOut: '2026-07-02T09:20:00Z',
        serviceCode: 'T1021',
      });
      await seedVisit(f, {
        clockIn: '2026-07-03T09:00:00Z',
        clockOut: '2026-07-03T15:00:00Z',
        serviceCode: 'T1021',
      });

      const page = await repo.listAuthorizations(f.agencyId, { asOf: '2026-07-15' });
      const row = page.rows.find((r) => r.id === authId);
      expect(row?.unitsUsed).toBe(2);
      expect(row?.unitsRemaining).toBe(8);
    });
  });

  describe('getPayrollReconciliation', () => {
    it('counts only verified visits toward verified hours', async () => {
      const f = await seedFixture();
      const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

      // 2h verified inside the 7d window; 3h flagged (excluded from hours,
      // included in completed); one open shift (in-progress).
      await seedVisit(f, { clockIn: hoursAgo(26), clockOut: hoursAgo(24) });
      await seedVisit(f, { clockIn: hoursAgo(50), clockOut: hoursAgo(47), status: 'flagged' });
      await seedVisit(f, { clockIn: hoursAgo(2), clockOut: null, status: 'pending' });

      const counts = await repo.getPayrollReconciliation(f.agencyId);
      expect(counts.verifiedHoursLast7d).toBeCloseTo(2, 5);
      expect(counts.verifiedHoursLast30d).toBeCloseTo(2, 5);
      expect(counts.completedVisitsLast7d).toBe(2);
      expect(counts.inProgressVisits).toBe(1);
    });
  });

  describe('getClaimReadinessBlockers', () => {
    it('reports counts for the full matching set even when the list is truncated', async () => {
      const f = await seedFixture();
      const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

      // 2 open shifts, 2 recent flagged, 1 recent pending = 5 blockers.
      await seedVisit(f, { clockIn: hoursAgo(30), clockOut: null, status: 'pending' });
      await seedVisit(f, {
        clockIn: hoursAgo(29),
        clockOut: null,
        status: 'pending',
        assignmentId: await seedAssignment(f),
      });
      await seedVisit(f, { clockIn: hoursAgo(28), clockOut: hoursAgo(26), status: 'flagged' });
      await seedVisit(f, { clockIn: hoursAgo(27), clockOut: hoursAgo(25), status: 'flagged' });
      await seedVisit(f, { clockIn: hoursAgo(26), clockOut: hoursAgo(24), status: 'pending' });
      // Verified visit: not a blocker.
      await seedVisit(f, { clockIn: hoursAgo(25), clockOut: hoursAgo(23) });

      const result = await repo.getClaimReadinessBlockers(f.agencyId, 2);
      expect(result.truncated).toBe(true);
      expect(result.blockers).toHaveLength(2);
      expect(result.counts).toEqual({ open: 2, flagged: 2, pending: 1, total: 5 });
    });

    it('does not leak visits across agencies', async () => {
      const f = await seedFixture();
      const other = await seedFixture();
      await seedVisit(other, { clockIn: new Date().toISOString(), clockOut: null });

      const result = await repo.getClaimReadinessBlockers(f.agencyId);
      expect(result.counts.total).toBe(0);
      expect(result.blockers).toHaveLength(0);
    });
  });

  describe('buildAuditDefensePacket', () => {
    it('produces a reproducible manifest hash matching the canonical CSV', async () => {
      const f = await seedFixture();
      await seedVisit(f, { clockIn: '2026-07-02T09:00:00Z', clockOut: '2026-07-02T11:00:00Z' });

      const from = '2026-07-01T00:00:00.000Z';
      const to = '2026-07-31T23:59:59.999Z';
      const first = await repo.buildAuditDefensePacket(f.agencyId, from, to);
      const second = await repo.buildAuditDefensePacket(f.agencyId, from, to);
      expect(first.rows.length).toBeGreaterThan(0);
      expect(first.manifestSha256).toBe(second.manifestSha256);

      // An auditor must be able to re-derive the hash from the CSV rows:
      // header + rows joined with \n, no trailing newline.
      const canonical = [
        AUDIT_DEFENSE_PACKET_COLUMNS.join(','),
        ...first.rows.map(auditPacketRowToCsv),
      ].join('\n');
      expect(createHash('sha256').update(canonical, 'utf8').digest('hex')).toBe(
        first.manifestSha256,
      );
    });
  });
});

describe('auditPacketRowToCsv', () => {
  it('escapes quotes, commas, and newlines per RFC 4180', () => {
    const csv = auditPacketRowToCsv({
      recordType: 'audit_event',
      id: 'id-1',
      occurredAt: '2026-07-01T00:00:00.000Z',
      actorId: null,
      visitId: 'v,1',
      caregiverId: 'cg"1',
      detailsJson: '{"note":"line1\nline2"}',
    });
    expect(csv).toBe(
      'audit_event,id-1,2026-07-01T00:00:00.000Z,,"v,1","cg""1","{""note"":""line1\nline2""}"',
    );
  });
});
