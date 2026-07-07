import { createHash } from 'crypto';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

// Pennsylvania State Capitol, the "client address" anchor for in-fence
// fixtures. New York City is far outside any reasonable geofence and
// simulates an off-site clock-in/out.
const PA_CAPITOL = { lat: 40.2647, lng: -76.8839, accuracy: 10 };
const NEW_YORK_CITY = { lat: 40.7589, lng: -73.9851, accuracy: 12 };

const agencyId = '00000000-0000-4000-8000-0000000000a0';
const otherAgencyId = '00000000-0000-4000-8000-0000000000b0';
const userId = '00000000-0000-4000-8000-0000000000a9';
const visitId = '00000000-0000-4000-8000-0000000000c1';
const assignmentId = '00000000-0000-4000-8000-0000000000c2';
const caregiverId = '00000000-0000-4000-8000-0000000000c3';
const clientId = '00000000-0000-4000-8000-0000000000c4';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) sorted[key] = canonicalize(record[key]);
    return sorted;
  }
  return value;
}

function sha256OfCanonicalJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
}

function baseVisit(overrides: Partial<core.EvvVisit> = {}): core.EvvVisit {
  return {
    id: visitId,
    assignmentId,
    caregiverId,
    clientId,
    serviceCode: 'T1019',
    clockInTime: '2026-06-01T14:00:00.000Z',
    clockOutTime: '2026-06-01T16:00:00.000Z',
    clockInLocation: PA_CAPITOL,
    clockOutLocation: PA_CAPITOL,
    status: 'verified',
    sandataStatus: 'submitted',
    sandataConfirmationId: 'SAND-CONF-1',
    hhaexchangeStatus: null,
    hhaexchangeConfirmationId: null,
    ...overrides
  };
}

const sameAgencyVisitEvent: core.AuditEvent = {
  id: '00000000-0000-4000-8000-0000000000d1',
  agencyId,
  actorId: userId,
  actorType: 'user',
  eventType: 'exception.filed',
  entityType: 'evv.visit',
  entityId: visitId,
  outcome: 'success',
  payload: { note: 'late clock-in flagged' },
  occurredAt: '2026-06-01T15:00:00.000Z'
};

interface MockOptions {
  visit?: core.EvvVisit | null;
  caregiver?: { firstName: string; lastName: string } | undefined;
  client?: { id: string; firstName: string; lastName: string } | undefined;
  clientGeofence?: { latitude: number | null; longitude: number | null; geofenceRadiusM: number | null } | undefined;
  schedule?: { scheduledStartTime: string | null; scheduledEndTime: string | null } | null;
  exceptions?: core.EvvException[];
  corrections?: Array<core.VisitMaintenance & { requesterName: string | null; approverName: string | null }>;
  auditEventsByEntity?: (agencyIdArg: string, entityType: string, entityId: string) => core.AuditEvent[];
  auditCreate?: () => Promise<unknown>;
}

function installMocks(options: MockOptions = {}) {
  const getVisitByIdForAgency = vi.fn().mockResolvedValue(
    options.visit === undefined ? baseVisit() : options.visit
  );
  vi.spyOn(core, 'EvvRepository').mockImplementation(() => ({ getVisitByIdForAgency } as any));

  const findById = vi.fn().mockResolvedValue(
    options.caregiver === undefined ? { firstName: 'Jane', lastName: 'Caregiver' } : options.caregiver
  );
  vi.spyOn(core, 'CaregiverRepository').mockImplementation(() => ({ findById } as any));

  const getClientNameForAgency = vi.fn().mockResolvedValue(
    options.client === undefined ? { id: clientId, firstName: 'John', lastName: 'Client' } : options.client
  );
  const getClientGeofence = vi.fn().mockResolvedValue(
    options.clientGeofence === undefined
      ? { latitude: PA_CAPITOL.lat, longitude: PA_CAPITOL.lng, geofenceRadiusM: 150 }
      : options.clientGeofence
  );
  vi.spyOn(core, 'ClientRepository').mockImplementation(
    () => ({ getClientNameForAgency, getClientGeofence } as any)
  );

  const getAssignmentScheduleForAgency = vi.fn().mockResolvedValue(
    options.schedule === undefined
      ? { scheduledStartTime: '2026-06-01T14:00:00.000Z', scheduledEndTime: '2026-06-01T16:00:00.000Z' }
      : options.schedule
  );
  vi.spyOn(core, 'ScheduleRepository').mockImplementation(
    () => ({ getAssignmentScheduleForAgency } as any)
  );

  const findExceptionsByVisitForAgency = vi.fn().mockResolvedValue(options.exceptions ?? []);
  vi.spyOn(core, 'EvvExceptionRepository').mockImplementation(
    () => ({ findExceptionsByVisitForAgency } as any)
  );

  const findByVisitIdForAgency = vi.fn().mockResolvedValue(options.corrections ?? []);
  vi.spyOn(core, 'VisitMaintenanceRepository').mockImplementation(
    () => ({ findByVisitIdForAgency } as any)
  );

  const findByEntityForAgency = vi.fn(
    async (aId: string, entityType: string, entityId: string) =>
      options.auditEventsByEntity?.(aId, entityType, entityId) ?? []
  );
  const auditCreate = vi.fn(options.auditCreate ?? (async () => ({})));
  vi.spyOn(core, 'AuditEventRepository').mockImplementation(
    () => ({ findByEntityForAgency, create: auditCreate } as any)
  );

  return { getVisitByIdForAgency, findById, getClientNameForAgency, getClientGeofence,
    getAssignmentScheduleForAgency, findExceptionsByVisitForAgency, findByVisitIdForAgency,
    findByEntityForAgency, auditCreate };
}

describe('GET /admin/audit-packet/:visitId', () => {
  describe('capability gating', () => {
    it.each(['coordinator', 'caregiver', 'family'] as const)('rejects %s with 403', async (role) => {
      installMocks();
      const response = await request(createApp())
        .get(`/admin/audit-packet/${visitId}`)
        .set('Authorization', `Bearer ${makeToken(role, agencyId, userId)}`);
      expect(response.status).toBe(403);
    });

    it('allows admin with audit.read (200)', async () => {
      installMocks();
      const response = await request(createApp())
        .get(`/admin/audit-packet/${visitId}`)
        .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);
      expect(response.status).toBe(200);
    });
  });

  it('returns 404 for a visit belonging to another agency', async () => {
    // getVisitByIdForAgency is tenant-scoped and returns null for a
    // cross-tenant id, simulate that here.
    installMocks({ visit: null });
    const response = await request(createApp())
      .get(`/admin/audit-packet/${visitId}`)
      .set('Authorization', `Bearer ${makeToken('admin', otherAgencyId, userId)}`);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Visit not found' });
  });

  it('returns an indistinguishable 404 for a nonexistent visit id', async () => {
    installMocks({ visit: null });
    const randomId = '00000000-0000-4000-8000-000000000fff';
    const crossTenant = await request(createApp())
      .get(`/admin/audit-packet/${visitId}`)
      .set('Authorization', `Bearer ${makeToken('admin', otherAgencyId, userId)}`);
    const nonexistent = await request(createApp())
      .get(`/admin/audit-packet/${randomId}`)
      .set('Authorization', `Bearer ${makeToken('admin', otherAgencyId, userId)}`);
    expect(nonexistent.status).toBe(crossTenant.status);
    expect(nonexistent.body).toEqual(crossTenant.body);
  });

  it('returns 400 for a non-UUID visit id', async () => {
    installMocks();
    const response = await request(createApp())
      .get('/admin/audit-packet/not-a-uuid')
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Valid visit id is required' });
  });

  it('assembles the full §3.3 response shape', async () => {
    const correction: core.VisitMaintenance & { requesterName: string | null; approverName: string | null } = {
      id: '00000000-0000-4000-8000-0000000000e1',
      visitId,
      agencyId,
      requesterId: '00000000-0000-4000-8000-0000000000e2',
      requesterName: 'Pat Requester',
      reason: 'Device damaged mid-shift',
      reasonCategoryCode: 'DCDB',
      correctionCode: 'TIME_CHANGE',
      status: 'approved',
      approverId: '00000000-0000-4000-8000-0000000000e3',
      approverName: 'Alex Approver',
      approvedAt: '2026-06-02T09:00:00.000Z',
      originalStartTime: '2026-06-01T14:00:00.000Z',
      originalEndTime: '2026-06-01T15:45:00.000Z',
      adjustedStartTime: '2026-06-01T14:00:00.000Z',
      adjustedEndTime: '2026-06-01T16:00:00.000Z'
    };
    const exception: core.EvvException = {
      id: '00000000-0000-4000-8000-0000000000f1',
      visitId,
      exceptionType: 'late-clock-in',
      reason: 'Traffic delay',
      approvedBy: '00000000-0000-4000-8000-0000000000f2',
      approvedAt: '2026-06-01T18:00:00.000Z'
    };

    installMocks({
      corrections: [correction],
      exceptions: [exception],
      auditEventsByEntity: (aId, entityType, entityId) => {
        if (entityType === 'evv.visit' && entityId === visitId) return [sameAgencyVisitEvent];
        return [];
      }
    });

    const response = await request(createApp())
      .get(`/admin/audit-packet/${visitId}`)
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    const body = response.body;

    expect(body.packet).toMatchObject({ generatedBy: userId, agencyId });
    expect(typeof body.packet.generatedAt).toBe('string');
    expect(typeof body.packet.integritySha256).toBe('string');
    expect(body.packet.integritySha256).toHaveLength(64);

    expect(body.visit).toMatchObject({
      id: visitId,
      status: 'verified',
      serviceCode: 'T1019',
      serviceDescription: expect.any(String),
      clockInTime: '2026-06-01T14:00:00.000Z',
      clockOutTime: '2026-06-01T16:00:00.000Z'
    });

    expect(body.caregiver).toEqual({ id: caregiverId, name: 'Jane Caregiver' });
    expect(body.client).toEqual({ id: clientId, name: 'John Client' });

    expect(Object.keys(body.curesActElements).sort()).toEqual(
      [...core.curesActEvvDataPoints].sort()
    );
    for (const point of core.curesActEvvDataPoints) {
      expect(typeof body.curesActElements[point]).toBe('boolean');
    }

    expect(body.geofence.clockIn.result).toBe('within');
    expect(body.geofence.clockOut.result).toBe('within');

    expect(body.exceptions).toHaveLength(1);
    expect(body.exceptions[0]).toMatchObject({
      id: exception.id,
      status: 'resolved',
      resolvedBy: exception.approvedBy
    });

    expect(body.corrections).toHaveLength(1);
    expect(body.corrections[0].approverId).toBe(correction.approverId);
    expect(body.corrections[0].approvedAt).toBe(correction.approvedAt);
    expect(body.corrections[0].requesterName).toBe('Pat Requester');
    expect(body.corrections[0].approverName).toBe('Alex Approver');

    expect(body.auditEvents).toHaveLength(1);
    expect(body.auditEvents[0]).toMatchObject({ id: sameAgencyVisitEvent.id, eventType: 'exception.filed' });
    expect(body.auditEvents[0].payloadSha256).toEqual(expect.stringMatching(/^[0-9a-f]{64}$/));
    expect(body.auditEvents[0].payload).toBeUndefined();

    expect(body.aggregator).toEqual({
      sandataStatus: 'submitted',
      sandataConfirmationId: 'SAND-CONF-1',
      hhaexchangeStatus: null,
      hhaexchangeConfirmationId: null
    });
  });

  describe('PHI-exclusion', () => {
    it('the response never contains raw coordinates, raw payloads, or identifiers', async () => {
      const exception: core.EvvException = {
        id: '00000000-0000-4000-8000-0000000000f1',
        visitId,
        exceptionType: 'late-clock-in',
        reason: 'Traffic delay',
        approvedAt: '2026-06-01T18:00:00.000Z'
      };
      installMocks({
        exceptions: [exception],
        auditEventsByEntity: (aId, entityType, entityId) => {
          if (entityType === 'evv.visit' && entityId === visitId) {
            return [{ ...sameAgencyVisitEvent, payload: { ssn: '123-45-6789', medicaid: '1234567890' } }];
          }
          return [];
        }
      });

      const response = await request(createApp())
        .get(`/admin/audit-packet/${visitId}`)
        .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

      expect(response.status).toBe(200);
      const raw = JSON.stringify(response.body);
      expect(raw).not.toMatch(/"lat"/);
      expect(raw).not.toMatch(/"lng"/);
      expect(raw).not.toMatch(/clockInLocation/);
      expect(raw).not.toMatch(/clockOutLocation/);
      expect(raw).not.toContain(String(PA_CAPITOL.lat));
      expect(raw).not.toContain(String(PA_CAPITOL.lng));
      expect(raw).not.toMatch(/"ssn"/i);
      expect(raw).not.toMatch(/"dob"/i);
      expect(raw).not.toMatch(/medicaid/i);
      expect(raw).not.toContain('123-45-6789');
      expect(raw).not.toContain('jane@example.com');

      for (const event of response.body.auditEvents) {
        expect(event.payloadSha256).toEqual(expect.stringMatching(/^[0-9a-f]{64}$/));
        expect(event).not.toHaveProperty('payload');
      }
    });
  });

  describe('geofence derivation', () => {
    it('reports "within" with distanceM <= allowedM for an in-fence visit', async () => {
      installMocks();
      const response = await request(createApp())
        .get(`/admin/audit-packet/${visitId}`)
        .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);
      expect(response.body.geofence.clockIn.result).toBe('within');
      expect(response.body.geofence.clockIn.distanceM).toBeLessThanOrEqual(
        response.body.geofence.clockIn.allowedM
      );
    });

    it('reports "out_of_bounds" for an out-of-fence visit', async () => {
      installMocks({
        visit: baseVisit({ clockInLocation: NEW_YORK_CITY, clockOutLocation: NEW_YORK_CITY })
      });
      const response = await request(createApp())
        .get(`/admin/audit-packet/${visitId}`)
        .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);
      expect(response.body.geofence.clockIn.result).toBe('out_of_bounds');
      expect(response.body.geofence.clockIn.distanceM).toBeGreaterThan(response.body.geofence.clockIn.allowedM);
    });

    it('reports "not_configured" when the client has no registered coordinates', async () => {
      installMocks({ clientGeofence: { latitude: null, longitude: null, geofenceRadiusM: 150 } });
      const response = await request(createApp())
        .get(`/admin/audit-packet/${visitId}`)
        .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);
      expect(response.body.geofence.clockIn.result).toBe('not_configured');
      expect(response.body.geofence.clockIn.distanceM).toBeNull();
    });

    it('reports "not_captured" for clock-out when the visit has no clock-out', async () => {
      installMocks({ visit: baseVisit({ clockOutTime: undefined, clockOutLocation: undefined }) });
      const response = await request(createApp())
        .get(`/admin/audit-packet/${visitId}`)
        .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);
      expect(response.body.geofence.clockOut.result).toBe('not_captured');
      expect(response.body.geofence.clockOut.captured).toBe(false);
    });
  });

  describe('audit-log-on-generate', () => {
    it('writes exactly one phi.export event carrying the response integrity hash', async () => {
      const { auditCreate } = installMocks();
      const response = await request(createApp())
        .get(`/admin/audit-packet/${visitId}`)
        .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

      expect(response.status).toBe(200);
      expect(auditCreate).toHaveBeenCalledTimes(1);
      expect(auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          agencyId,
          actorId: userId,
          eventType: 'phi.export',
          entityType: 'evv.visit.audit-packet',
          entityId: visitId,
          outcome: 'success',
          payload: expect.objectContaining({ integritySha256: response.body.packet.integritySha256 })
        })
      );
    });

    it('writes no phi.export event on a 404', async () => {
      const { auditCreate } = installMocks({ visit: null });
      const response = await request(createApp())
        .get(`/admin/audit-packet/${visitId}`)
        .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);
      expect(response.status).toBe(404);
      expect(auditCreate).not.toHaveBeenCalled();
    });
  });

  it('fails closed (500, no packet body) when the audit write throws', async () => {
    installMocks({
      auditCreate: async () => {
        throw new Error('audit_events insert failed');
      }
    });
    const response = await request(createApp())
      .get(`/admin/audit-packet/${visitId}`)
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Internal Server Error' });
    expect(response.body.visit).toBeUndefined();
    expect(response.body.packet).toBeUndefined();
  });

  describe('integrity hash', () => {
    it('matches an independently recomputed SHA-256 of the canonical response minus the hash', async () => {
      installMocks();
      const response = await request(createApp())
        .get(`/admin/audit-packet/${visitId}`)
        .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

      const { packet, ...rest } = response.body;
      const { integritySha256, ...packetWithoutHash } = packet;
      const recomputed = sha256OfCanonicalJson({ packet: packetWithoutHash, ...rest });
      expect(recomputed).toBe(integritySha256);
    });

    it('two consecutive generations of an unchanged visit differ only in generatedAt/hash', async () => {
      installMocks();
      const app = createApp();
      const first = await request(app)
        .get(`/admin/audit-packet/${visitId}`)
        .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);
      const second = await request(app)
        .get(`/admin/audit-packet/${visitId}`)
        .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

      const stripVolatile = (body: any) => {
        const { packet, ...rest } = body;
        const { generatedAt, integritySha256, ...packetRest } = packet;
        return { packet: packetRest, rest };
      };
      expect(stripVolatile(first.body)).toEqual(stripVolatile(second.body));
      expect(first.body.packet.integritySha256).not.toBe(second.body.packet.integritySha256);
    });
  });

  it('does not leak audit events belonging to another agency (tenancy of sub-collections)', async () => {
    const { findByEntityForAgency } = installMocks({
      auditEventsByEntity: (aId, entityType, entityId) => {
        if (aId !== agencyId) return [];
        if (entityType === 'evv.visit' && entityId === visitId) return [sameAgencyVisitEvent];
        return [];
      }
    });

    const response = await request(createApp())
      .get(`/admin/audit-packet/${visitId}`)
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body.auditEvents).toHaveLength(1);
    expect(response.body.auditEvents[0].id).toBe(sameAgencyVisitEvent.id);
    expect(findByEntityForAgency).toHaveBeenCalledWith(agencyId, 'evv.visit', visitId);
    expect(findByEntityForAgency).toHaveBeenCalledWith(agencyId, 'evv.clock-out', visitId);
    expect(findByEntityForAgency).toHaveBeenCalledWith(agencyId, 'evv.clock-in', assignmentId);
  });

  it('is mounted under adminAuditLimiter (30 requests / 15 min), enforced outside the test environment', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
    try {
      installMocks();
      const app = createApp();
      let lastStatus = 0;
      for (let i = 0; i < 31; i += 1) {
        const response = await request(app)
          .get(`/admin/audit-packet/${visitId}`)
          .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);
        lastStatus = response.status;
      }
      expect(lastStatus).toBe(429);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    }
  }, 30000);
});
