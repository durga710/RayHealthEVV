import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

const agencyId = 'agency-1';
const userId = 'user-1';

describe('Compliance Engine, audit-defense preview', () => {
  it('returns counts + PA policy for an admin in the agency', async () => {
    const getAuditDefensePreview = vi.fn().mockResolvedValue({
      auditEvents: 42,
      vmurRecords: 7,
      evvVisits: 318,
      activeCaregivers: 19,
    });

    vi.spyOn(core, 'ComplianceEngineRepository').mockImplementation(
      function ComplianceEngineRepositoryMock() {
        return { getAuditDefensePreview } as unknown as core.ComplianceEngineRepository;
      } as unknown as typeof core.ComplianceEngineRepository,
    );

    const response = await request(createApp())
      .get('/api/compliance-engine/audit-defense/preview')
      .query({ from: '2026-04-01', to: '2026-04-30' })
      .set(
        'Authorization',
        `Bearer ${makeToken('admin', agencyId, userId)}`,
      );

    expect(response.status).toBe(200);
    expect(response.body.agencyId).toBe(agencyId);
    expect(response.body.counts).toEqual({
      auditEvents: 42,
      vmurRecords: 7,
      evvVisits: 318,
      activeCaregivers: 19,
    });
    expect(response.body.policy).toEqual({
      retentionFloorYears: core.PA_RETENTION_YEARS,
      dhsResponseSlaHours: core.PA_DHS_AUDIT_RESPONSE_HOURS,
    });
    // From is normalised to start-of-day UTC; To to end-of-day UTC.
    expect(response.body.periodFrom).toMatch(/^2026-04-01T00:00:00\.000Z$/);
    expect(response.body.periodTo).toMatch(/^2026-04-30T23:59:59\.999Z$/);
    expect(getAuditDefensePreview).toHaveBeenCalledWith(
      agencyId,
      '2026-04-01T00:00:00.000Z',
      '2026-04-30T23:59:59.999Z',
    );
  });

  it('rejects a caregiver token (lacks audit.read capability)', async () => {
    const getAuditDefensePreview = vi.fn();
    vi.spyOn(core, 'ComplianceEngineRepository').mockImplementation(
      function ComplianceEngineRepositoryMock() {
        return { getAuditDefensePreview } as unknown as core.ComplianceEngineRepository;
      } as unknown as typeof core.ComplianceEngineRepository,
    );

    const response = await request(createApp())
      .get('/api/compliance-engine/audit-defense/preview')
      .query({ from: '2026-04-01', to: '2026-04-30' })
      .set(
        'Authorization',
        `Bearer ${makeToken('caregiver', agencyId, userId, 'caregiver-1')}`,
      );

    expect(response.status).toBe(403);
    expect(getAuditDefensePreview).not.toHaveBeenCalled();
  });

  it('returns 400 when the from/to range is missing or invalid', async () => {
    const getAuditDefensePreview = vi.fn();
    vi.spyOn(core, 'ComplianceEngineRepository').mockImplementation(
      function ComplianceEngineRepositoryMock() {
        return { getAuditDefensePreview } as unknown as core.ComplianceEngineRepository;
      } as unknown as typeof core.ComplianceEngineRepository,
    );

    const response = await request(createApp())
      .get('/api/compliance-engine/audit-defense/preview')
      .query({ from: 'not-a-date', to: '2026-04-30' })
      .set(
        'Authorization',
        `Bearer ${makeToken('admin', agencyId, userId)}`,
      );

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/valid from\/to/i);
    expect(getAuditDefensePreview).not.toHaveBeenCalled();
  });

  it('returns 400 when `from` is after `to`', async () => {
    const getAuditDefensePreview = vi.fn();
    vi.spyOn(core, 'ComplianceEngineRepository').mockImplementation(
      function ComplianceEngineRepositoryMock() {
        return { getAuditDefensePreview } as unknown as core.ComplianceEngineRepository;
      } as unknown as typeof core.ComplianceEngineRepository,
    );

    const response = await request(createApp())
      .get('/api/compliance-engine/audit-defense/preview')
      .query({ from: '2026-05-01', to: '2026-04-01' })
      .set(
        'Authorization',
        `Bearer ${makeToken('admin', agencyId, userId)}`,
      );

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/from.*before.*to/i);
    expect(getAuditDefensePreview).not.toHaveBeenCalled();
  });
});

describe('Compliance Engine, authorizations overview', () => {
  const mockCounts = {
    activeAuthorizations: 25,
    expiringIn14d: 3,
    expiringIn30d: 8,
    recentlyExpired: 2,
  };

  function spyRepo(impl: () => Partial<core.ComplianceEngineRepository>) {
    vi.spyOn(core, 'ComplianceEngineRepository').mockImplementation(
      function ComplianceEngineRepositoryMock() {
        return impl() as unknown as core.ComplianceEngineRepository;
      } as unknown as typeof core.ComplianceEngineRepository,
    );
  }

  it('returns counts + asOf + policy for an admin', async () => {
    const getAuthorizationOversight = vi.fn().mockResolvedValue(mockCounts);
    spyRepo(() => ({ getAuthorizationOversight }));

    const response = await request(createApp())
      .get('/api/compliance-engine/authorizations/overview')
      .query({ asOf: '2026-05-26' })
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body.counts).toEqual(mockCounts);
    expect(response.body.asOf).toBe('2026-05-26');
    expect(response.body.policy.chcQuarterlyReviewDays).toBe(
      core.PA_RN_SUPERVISION_CHC_DAYS,
    );
    expect(getAuthorizationOversight).toHaveBeenCalledWith(agencyId, '2026-05-26');
  });

  it('allows a coordinator (has client.read)', async () => {
    const getAuthorizationOversight = vi.fn().mockResolvedValue(mockCounts);
    spyRepo(() => ({ getAuthorizationOversight }));

    const response = await request(createApp())
      .get('/api/compliance-engine/authorizations/overview')
      .query({ asOf: '2026-05-26' })
      .set(
        'Authorization',
        `Bearer ${makeToken('coordinator', agencyId, userId)}`,
      );

    expect(response.status).toBe(200);
    expect(getAuthorizationOversight).toHaveBeenCalled();
  });

  it('rejects a caregiver token (lacks client.read)', async () => {
    const getAuthorizationOversight = vi.fn();
    spyRepo(() => ({ getAuthorizationOversight }));

    const response = await request(createApp())
      .get('/api/compliance-engine/authorizations/overview')
      .query({ asOf: '2026-05-26' })
      .set(
        'Authorization',
        `Bearer ${makeToken('caregiver', agencyId, userId, 'caregiver-1')}`,
      );

    expect(response.status).toBe(403);
    expect(getAuthorizationOversight).not.toHaveBeenCalled();
  });

  it('defaults asOf to today when not provided', async () => {
    const getAuthorizationOversight = vi.fn().mockResolvedValue(mockCounts);
    spyRepo(() => ({ getAuthorizationOversight }));

    const today = new Date().toISOString().slice(0, 10);
    const response = await request(createApp())
      .get('/api/compliance-engine/authorizations/overview')
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body.asOf).toBe(today);
    expect(getAuthorizationOversight).toHaveBeenCalledWith(agencyId, today);
  });

  it('rejects an invalid asOf format', async () => {
    const getAuthorizationOversight = vi.fn();
    spyRepo(() => ({ getAuthorizationOversight }));

    const response = await request(createApp())
      .get('/api/compliance-engine/authorizations/overview')
      .query({ asOf: 'yesterday' })
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/YYYY-MM-DD/);
    expect(getAuthorizationOversight).not.toHaveBeenCalled();
  });
});

describe('Compliance Engine, summary', () => {
  const mockSummary = {
    auditEventsLast30d: 1024,
    activeAuthorizations: 84,
    openExceptions: 12,
    activeMaCases: 78,
    verifiedHoursLast7d: 412.5,
    claimReadyLast7d: 96,
    activeCredentials: 240,
  };

  function spyRepo(impl: () => Partial<core.ComplianceEngineRepository>) {
    vi.spyOn(core, 'ComplianceEngineRepository').mockImplementation(
      function ComplianceEngineRepositoryMock() {
        return impl() as unknown as core.ComplianceEngineRepository;
      } as unknown as typeof core.ComplianceEngineRepository,
    );
  }

  it('returns aggregated headline KPIs for an admin', async () => {
    const getEngineSummary = vi.fn().mockResolvedValue(mockSummary);
    spyRepo(() => ({ getEngineSummary }));

    const response = await request(createApp())
      .get('/api/compliance-engine/summary')
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body.counts).toEqual(mockSummary);
    expect(response.body.agencyId).toBe(agencyId);
    expect(typeof response.body.asOf).toBe('string');
    expect(getEngineSummary).toHaveBeenCalledWith(agencyId, response.body.asOf);
  });

  it('rejects a coordinator (lacks audit.read)', async () => {
    const getEngineSummary = vi.fn();
    spyRepo(() => ({ getEngineSummary }));

    const response = await request(createApp())
      .get('/api/compliance-engine/summary')
      .set(
        'Authorization',
        `Bearer ${makeToken('coordinator', agencyId, userId)}`,
      );

    expect(response.status).toBe(403);
    expect(getEngineSummary).not.toHaveBeenCalled();
  });
});

describe('Compliance Engine, credentials overview', () => {
  const mockCounts = {
    activeCredentials: 240,
    pendingCredentials: 8,
    expiredCredentials: 12,
    expiringIn30d: 5,
    expiringIn90d: 18,
    recentlyExpired: 3,
  };

  function spyRepo(impl: () => Partial<core.ComplianceEngineRepository>) {
    vi.spyOn(core, 'ComplianceEngineRepository').mockImplementation(
      function ComplianceEngineRepositoryMock() {
        return impl() as unknown as core.ComplianceEngineRepository;
      } as unknown as typeof core.ComplianceEngineRepository,
    );
  }

  it('returns counts + PA credential taxonomy in policy', async () => {
    const getCredentialsCompliance = vi.fn().mockResolvedValue(mockCounts);
    spyRepo(() => ({ getCredentialsCompliance }));

    const response = await request(createApp())
      .get('/api/compliance-engine/credentials/overview')
      .query({ asOf: '2026-05-26' })
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body.counts).toEqual(mockCounts);
    expect(response.body.policy.backgroundCheckRenewalYears).toBe(
      core.PA_BACKGROUND_CHECK_RENEWAL_YEARS,
    );
    expect(response.body.policy.paComplianceCredentials).toEqual([
      ...core.paComplianceCredentials,
    ]);
    expect(getCredentialsCompliance).toHaveBeenCalledWith(agencyId, '2026-05-26');
  });

  it('rejects a caregiver token (lacks staff.read)', async () => {
    const getCredentialsCompliance = vi.fn();
    spyRepo(() => ({ getCredentialsCompliance }));

    const response = await request(createApp())
      .get('/api/compliance-engine/credentials/overview')
      .set(
        'Authorization',
        `Bearer ${makeToken('caregiver', agencyId, userId, 'caregiver-1')}`,
      );

    expect(response.status).toBe(403);
    expect(getCredentialsCompliance).not.toHaveBeenCalled();
  });
});

describe('Compliance Engine, claims overview', () => {
  const mockCounts = {
    verifiedVisitsLast7d: 84,
    verifiedVisitsLast30d: 340,
    flaggedVisitsLast7d: 3,
    pendingVisits: 6,
  };

  function spyRepo(impl: () => Partial<core.ComplianceEngineRepository>) {
    vi.spyOn(core, 'ComplianceEngineRepository').mockImplementation(
      function ComplianceEngineRepositoryMock() {
        return impl() as unknown as core.ComplianceEngineRepository;
      } as unknown as typeof core.ComplianceEngineRepository,
    );
  }

  it('returns counts + Sandata submission window in policy', async () => {
    const getClaimMatching = vi.fn().mockResolvedValue(mockCounts);
    spyRepo(() => ({ getClaimMatching }));

    const response = await request(createApp())
      .get('/api/compliance-engine/claims/overview')
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body.counts).toEqual(mockCounts);
    expect(response.body.policy.sandataSubmissionWindowDays).toBe(
      core.PA_SANDATA_SUBMISSION_WINDOW_DAYS,
    );
    expect(getClaimMatching).toHaveBeenCalledWith(agencyId);
  });

  it('rejects a caregiver token (lacks evv.read)', async () => {
    const getClaimMatching = vi.fn();
    spyRepo(() => ({ getClaimMatching }));

    const response = await request(createApp())
      .get('/api/compliance-engine/claims/overview')
      .set(
        'Authorization',
        `Bearer ${makeToken('caregiver', agencyId, userId, 'caregiver-1')}`,
      );

    expect(response.status).toBe(403);
    expect(getClaimMatching).not.toHaveBeenCalled();
  });
});

describe('Compliance Engine, payroll overview', () => {
  const mockCounts = {
    verifiedHoursLast7d: 412.5,
    verifiedHoursLast30d: 1840,
    completedVisitsLast7d: 96,
    inProgressVisits: 4,
  };

  function spyRepo(impl: () => Partial<core.ComplianceEngineRepository>) {
    vi.spyOn(core, 'ComplianceEngineRepository').mockImplementation(
      function ComplianceEngineRepositoryMock() {
        return impl() as unknown as core.ComplianceEngineRepository;
      } as unknown as typeof core.ComplianceEngineRepository,
    );
  }

  it('returns counts + grace-period policy for an admin', async () => {
    const getPayrollReconciliation = vi.fn().mockResolvedValue(mockCounts);
    spyRepo(() => ({ getPayrollReconciliation }));

    const response = await request(createApp())
      .get('/api/compliance-engine/payroll/overview')
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body.counts).toEqual(mockCounts);
    expect(response.body.policy.gracePeriodMinutes).toBe(
      core.PA_GRACE_PERIOD_MINUTES,
    );
    expect(getPayrollReconciliation).toHaveBeenCalledWith(agencyId);
  });

  it('rejects a caregiver token (lacks evv.read)', async () => {
    const getPayrollReconciliation = vi.fn();
    spyRepo(() => ({ getPayrollReconciliation }));

    const response = await request(createApp())
      .get('/api/compliance-engine/payroll/overview')
      .set(
        'Authorization',
        `Bearer ${makeToken('caregiver', agencyId, userId, 'caregiver-1')}`,
      );

    expect(response.status).toBe(403);
    expect(getPayrollReconciliation).not.toHaveBeenCalled();
  });
});

describe('Compliance Engine. Medicaid workflow overview', () => {
  const mockCounts = {
    activeMaCases: 84,
    distinctPayers: 4,
    distinctServiceCodes: 6,
    newAuthsLast30d: 11,
  };

  function spyRepo(impl: () => Partial<core.ComplianceEngineRepository>) {
    vi.spyOn(core, 'ComplianceEngineRepository').mockImplementation(
      function ComplianceEngineRepositoryMock() {
        return impl() as unknown as core.ComplianceEngineRepository;
      } as unknown as typeof core.ComplianceEngineRepository,
    );
  }

  it('returns counts + chc MCOs in policy for an admin', async () => {
    const getMedicaidWorkflow = vi.fn().mockResolvedValue(mockCounts);
    spyRepo(() => ({ getMedicaidWorkflow }));

    const response = await request(createApp())
      .get('/api/compliance-engine/medicaid/overview')
      .query({ asOf: '2026-05-26' })
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body.counts).toEqual(mockCounts);
    expect(response.body.policy.chcQuarterlyReviewDays).toBe(
      core.PA_RN_SUPERVISION_CHC_DAYS,
    );
    expect(response.body.policy.chcMcos).toEqual([
      'AmeriHealth Caritas Northeast',
      'Pennsylvania Health & Wellness',
      'UPMC Community HealthChoices',
    ]);
    expect(getMedicaidWorkflow).toHaveBeenCalledWith(agencyId, '2026-05-26');
  });

  it('rejects a caregiver token (lacks client.read)', async () => {
    const getMedicaidWorkflow = vi.fn();
    spyRepo(() => ({ getMedicaidWorkflow }));

    const response = await request(createApp())
      .get('/api/compliance-engine/medicaid/overview')
      .set(
        'Authorization',
        `Bearer ${makeToken('caregiver', agencyId, userId, 'caregiver-1')}`,
      );

    expect(response.status).toBe(403);
    expect(getMedicaidWorkflow).not.toHaveBeenCalled();
  });
});

describe('Compliance Engine, audit-defense packet.csv', () => {
  function spyRepo(impl: () => Partial<core.ComplianceEngineRepository>) {
    vi.spyOn(core, 'ComplianceEngineRepository').mockImplementation(
      function ComplianceEngineRepositoryMock() {
        return impl() as unknown as core.ComplianceEngineRepository;
      } as unknown as typeof core.ComplianceEngineRepository,
    );
  }

  function spyAuditRepo() {
    const create = vi.fn().mockResolvedValue({ id: 'evt-1' });
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      function AuditEventRepositoryMock() {
        return { create } as unknown as core.AuditEventRepository;
      } as unknown as typeof core.AuditEventRepository,
    );
    return create;
  }

  it('streams a CSV with manifest header for an admin', async () => {
    const buildAuditDefensePacket = vi.fn().mockResolvedValue({
      agencyId,
      periodFrom: '2026-04-01T00:00:00.000Z',
      periodTo: '2026-04-30T23:59:59.999Z',
      counts: { auditEvents: 2, vmurRecords: 1, evvVisits: 3, activeCaregivers: 5 },
      rows: [
        {
          recordType: 'audit_event',
          id: 'evt-1',
          occurredAt: '2026-04-02T10:00:00.000Z',
          actorId: 'user-1',
          visitId: null,
          caregiverId: null,
          detailsJson: '{"eventType":"visit.created"}',
        },
        {
          recordType: 'vmur',
          id: 'vmur-1',
          occurredAt: '2026-04-03T11:00:00.000Z',
          actorId: 'user-1',
          visitId: 'visit-1',
          caregiverId: null,
          detailsJson: '{"status":"pending"}',
        },
      ],
      manifestSha256: 'abc123def456',
    });
    spyRepo(() => ({ buildAuditDefensePacket }));
    const auditCreate = spyAuditRepo();

    const response = await request(createApp())
      .get('/api/compliance-engine/audit-defense/packet.csv')
      .query({ from: '2026-04-01', to: '2026-04-30' })
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/csv/);
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['content-disposition']).toContain('audit-defense-packet-2026-04-01-2026-04-30.csv');
    expect(response.headers['x-manifest-sha256']).toBe('abc123def456');
    expect(response.headers['x-packet-audit-events']).toBe('2');
    expect(response.headers['x-packet-vmur-records']).toBe('1');
    expect(response.headers['x-packet-evv-visits']).toBe('3');
    expect(response.headers['x-packet-active-caregivers']).toBe('5');
    const csv = response.text;
    expect(csv.split('\n')[0]).toBe(
      'record_type,id,occurred_at,actor_id,visit_id,caregiver_id,details_json',
    );
    expect(csv).toContain('audit_event,evt-1,2026-04-02T10:00:00.000Z,user-1,,,');
    expect(csv).toContain('vmur,vmur-1,2026-04-03T11:00:00.000Z,user-1,visit-1,,');
    expect(buildAuditDefensePacket).toHaveBeenCalledWith(
      agencyId,
      '2026-04-01T00:00:00.000Z',
      '2026-04-30T23:59:59.999Z',
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'phi.export',
        entityType: 'audit-defense-packet',
        entityId: agencyId,
        outcome: 'success',
        payload: expect.objectContaining({
          manifestSha256: 'abc123def456',
          rowCount: 2,
        }),
      }),
    );
  });

  it('rejects a caregiver token (lacks audit.read)', async () => {
    const buildAuditDefensePacket = vi.fn();
    spyRepo(() => ({ buildAuditDefensePacket }));

    const response = await request(createApp())
      .get('/api/compliance-engine/audit-defense/packet.csv')
      .query({ from: '2026-04-01', to: '2026-04-30' })
      .set(
        'Authorization',
        `Bearer ${makeToken('caregiver', agencyId, userId, 'caregiver-1')}`,
      );

    expect(response.status).toBe(403);
    expect(buildAuditDefensePacket).not.toHaveBeenCalled();
  });

  it('returns 400 when from > to', async () => {
    const buildAuditDefensePacket = vi.fn();
    spyRepo(() => ({ buildAuditDefensePacket }));

    const response = await request(createApp())
      .get('/api/compliance-engine/audit-defense/packet.csv')
      .query({ from: '2026-05-01', to: '2026-04-01' })
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(400);
    expect(buildAuditDefensePacket).not.toHaveBeenCalled();
  });
});

describe('Compliance Engine, authorizations list', () => {
  const mockPage = {
    rows: [
      {
        id: 'auth-1',
        clientId: 'client-1',
        clientName: 'Demo Client',
        payerId: 'pa-medicaid',
        serviceCode: 'S5125',
        startDate: '2026-01-01',
        endDate: '2026-06-30',
        unitsAuthorized: 480,
        unitsUsed: 120,
        unitsRemaining: 360,
        daysToExpiry: 35,
        urgency: 'warning' as const,
      },
    ],
    total: 1,
    limit: 25,
    offset: 0,
    asOf: '2026-05-26',
  };

  function spyRepo(impl: () => Partial<core.ComplianceEngineRepository>) {
    vi.spyOn(core, 'ComplianceEngineRepository').mockImplementation(
      function ComplianceEngineRepositoryMock() {
        return impl() as unknown as core.ComplianceEngineRepository;
      } as unknown as typeof core.ComplianceEngineRepository,
    );
  }

  it('returns rows + total + policy for an admin', async () => {
    const listAuthorizations = vi.fn().mockResolvedValue(mockPage);
    spyRepo(() => ({ listAuthorizations }));

    const response = await request(createApp())
      .get('/api/compliance-engine/authorizations/list')
      .query({ asOf: '2026-05-26', filter: 'expiring-30d', limit: 25, offset: 0 })
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body.rows).toEqual(mockPage.rows);
    expect(response.body.total).toBe(1);
    expect(response.body.asOf).toBe('2026-05-26');
    expect(response.body.policy.chcQuarterlyReviewDays).toBe(
      core.PA_RN_SUPERVISION_CHC_DAYS,
    );
    expect(listAuthorizations).toHaveBeenCalledWith(agencyId, {
      asOf: '2026-05-26',
      filter: 'expiring-30d',
      limit: 25,
      offset: 0,
    });
  });

  it('allows a coordinator (has client.read)', async () => {
    const listAuthorizations = vi.fn().mockResolvedValue(mockPage);
    spyRepo(() => ({ listAuthorizations }));

    const response = await request(createApp())
      .get('/api/compliance-engine/authorizations/list')
      .set(
        'Authorization',
        `Bearer ${makeToken('coordinator', agencyId, userId)}`,
      );

    expect(response.status).toBe(200);
    expect(listAuthorizations).toHaveBeenCalled();
  });

  it('rejects an invalid filter', async () => {
    const listAuthorizations = vi.fn();
    spyRepo(() => ({ listAuthorizations }));

    const response = await request(createApp())
      .get('/api/compliance-engine/authorizations/list')
      .query({ filter: 'nope' })
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(400);
    expect(listAuthorizations).not.toHaveBeenCalled();
  });

  it('rejects a caregiver token (lacks client.read)', async () => {
    const listAuthorizations = vi.fn();
    spyRepo(() => ({ listAuthorizations }));

    const response = await request(createApp())
      .get('/api/compliance-engine/authorizations/list')
      .set(
        'Authorization',
        `Bearer ${makeToken('caregiver', agencyId, userId, 'caregiver-1')}`,
      );

    expect(response.status).toBe(403);
    expect(listAuthorizations).not.toHaveBeenCalled();
  });
});

describe('Compliance Engine, exceptions list + acknowledge', () => {
  const validUuid = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const mockPage = {
    rows: [
      {
        id: validUuid,
        visitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        caregiverId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        agencyId,
        exceptionType: 'late-clock-in',
        reason: 'Caregiver arrived 18 min late, traffic',
        createdAt: '2026-05-25T08:00:00.000Z',
        visitClockInTime: '2026-05-25T08:18:00.000Z',
        visitStatus: 'flagged',
      },
    ],
    total: 1,
    limit: 50,
    offset: 0,
  };

  function spyRepo(impl: () => Partial<core.ComplianceEngineRepository>) {
    vi.spyOn(core, 'ComplianceEngineRepository').mockImplementation(
      function ComplianceEngineRepositoryMock() {
        return impl() as unknown as core.ComplianceEngineRepository;
      } as unknown as typeof core.ComplianceEngineRepository,
    );
  }

  function spyAuditRepo() {
    const create = vi.fn().mockResolvedValue({ id: 'evt-1' });
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      function AuditEventRepositoryMock() {
        return { create } as unknown as core.AuditEventRepository;
      } as unknown as typeof core.AuditEventRepository,
    );
    return create;
  }

  it('lists open exceptions for an admin', async () => {
    const listOpenExceptions = vi.fn().mockResolvedValue(mockPage);
    spyRepo(() => ({ listOpenExceptions }));

    const response = await request(createApp())
      .get('/api/compliance-engine/exceptions/list')
      .query({ type: 'late-clock-in', limit: 50 })
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body.rows).toEqual(mockPage.rows);
    expect(response.body.total).toBe(1);
    expect(response.body.policy.dhsResponseSlaHours).toBe(
      core.PA_DHS_AUDIT_RESPONSE_HOURS,
    );
    expect(listOpenExceptions).toHaveBeenCalledWith(agencyId, {
      type: 'late-clock-in',
      limit: 50,
      offset: undefined,
    });
  });

  it('rejects an invalid exception type', async () => {
    const listOpenExceptions = vi.fn();
    spyRepo(() => ({ listOpenExceptions }));

    const response = await request(createApp())
      .get('/api/compliance-engine/exceptions/list')
      .query({ type: 'not-a-type' })
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(400);
    expect(listOpenExceptions).not.toHaveBeenCalled();
  });

  it('rejects a caregiver token (lacks evv.read)', async () => {
    const listOpenExceptions = vi.fn();
    spyRepo(() => ({ listOpenExceptions }));

    const response = await request(createApp())
      .get('/api/compliance-engine/exceptions/list')
      .set(
        'Authorization',
        `Bearer ${makeToken('caregiver', agencyId, userId, 'caregiver-1')}`,
      );

    expect(response.status).toBe(403);
    expect(listOpenExceptions).not.toHaveBeenCalled();
  });

  it('acknowledges an exception and emits one exception.approved audit event', async () => {
    const acknowledgeException = vi.fn().mockResolvedValue({
      id: validUuid,
      visitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      exceptionType: 'late-clock-in',
      reason: 'Caregiver arrived 18 min late, traffic',
      approvedBy: userId,
      approvedAt: '2026-05-26T20:30:00.000Z',
    });
    spyRepo(() => ({ acknowledgeException }));
    const auditCreate = spyAuditRepo();

    const response = await request(createApp())
      .post(`/api/compliance-engine/exceptions/${validUuid}/acknowledge`)
      .send({ note: 'Reviewed with caregiver; traffic confirmed.' })
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body.exception.id).toBe(validUuid);
    expect(response.body.acknowledgedBy).toBe(userId);
    expect(acknowledgeException).toHaveBeenCalledWith(agencyId, validUuid, userId);
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'exception.approved',
        entityType: 'evv_exception',
        entityId: validUuid,
        payload: expect.objectContaining({
          note: 'Reviewed with caregiver; traffic confirmed.',
        }),
      }),
    );
  });

  it('returns 409 when the exception is missing or already acknowledged', async () => {
    const acknowledgeException = vi.fn().mockResolvedValue(null);
    spyRepo(() => ({ acknowledgeException }));

    const response = await request(createApp())
      .post(`/api/compliance-engine/exceptions/${validUuid}/acknowledge`)
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('not_found_or_already_acknowledged');
  });

  it('rejects acknowledge for non-UUID id', async () => {
    const acknowledgeException = vi.fn();
    spyRepo(() => ({ acknowledgeException }));

    const response = await request(createApp())
      .post(`/api/compliance-engine/exceptions/not-a-uuid/acknowledge`)
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(400);
    expect(acknowledgeException).not.toHaveBeenCalled();
  });

  it('rejects acknowledge for a coordinator (lacks audit.read)', async () => {
    const acknowledgeException = vi.fn();
    spyRepo(() => ({ acknowledgeException }));

    const response = await request(createApp())
      .post(`/api/compliance-engine/exceptions/${validUuid}/acknowledge`)
      .set(
        'Authorization',
        `Bearer ${makeToken('coordinator', agencyId, userId)}`,
      );

    expect(response.status).toBe(403);
    expect(acknowledgeException).not.toHaveBeenCalled();
  });
});

describe('Compliance Engine, exceptions overview', () => {
  const mockCounts = {
    openExceptions: 12,
    lateClockInOpen: 5,
    missingLocationOpen: 3,
    manualEntryOpen: 2,
    telephonyFallbackOpen: 2,
    vmurPending: 4,
  };

  function spyRepo(impl: () => Partial<core.ComplianceEngineRepository>) {
    vi.spyOn(core, 'ComplianceEngineRepository').mockImplementation(
      function ComplianceEngineRepositoryMock() {
        return impl() as unknown as core.ComplianceEngineRepository;
      } as unknown as typeof core.ComplianceEngineRepository,
    );
  }

  it('returns counts + policy for an admin', async () => {
    const getExceptionResolution = vi.fn().mockResolvedValue(mockCounts);
    spyRepo(() => ({ getExceptionResolution }));

    const response = await request(createApp())
      .get('/api/compliance-engine/exceptions/overview')
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body.counts).toEqual(mockCounts);
    expect(response.body.agencyId).toBe(agencyId);
    expect(response.body.policy.dhsResponseSlaHours).toBe(
      core.PA_DHS_AUDIT_RESPONSE_HOURS,
    );
    expect(typeof response.body.asOf).toBe('string');
    expect(getExceptionResolution).toHaveBeenCalledWith(agencyId);
  });

  it('rejects a coordinator (lacks audit.read)', async () => {
    const getExceptionResolution = vi.fn();
    spyRepo(() => ({ getExceptionResolution }));

    const response = await request(createApp())
      .get('/api/compliance-engine/exceptions/overview')
      .set(
        'Authorization',
        `Bearer ${makeToken('coordinator', agencyId, userId)}`,
      );

    expect(response.status).toBe(403);
    expect(getExceptionResolution).not.toHaveBeenCalled();
  });

  it('rejects a caregiver token (lacks audit.read)', async () => {
    const getExceptionResolution = vi.fn();
    spyRepo(() => ({ getExceptionResolution }));

    const response = await request(createApp())
      .get('/api/compliance-engine/exceptions/overview')
      .set(
        'Authorization',
        `Bearer ${makeToken('caregiver', agencyId, userId, 'caregiver-1')}`,
      );

    expect(response.status).toBe(403);
    expect(getExceptionResolution).not.toHaveBeenCalled();
  });
});

describe('Compliance Engine, claim readiness blockers', () => {
  function spyRepo(impl: () => Partial<core.ComplianceEngineRepository>) {
    vi.spyOn(core, 'ComplianceEngineRepository').mockImplementation(
      function ComplianceEngineRepositoryMock() {
        return impl() as unknown as core.ComplianceEngineRepository;
      } as unknown as typeof core.ComplianceEngineRepository,
    );
  }

  it('returns the actionable blocker list + counts for an admin', async () => {
    const getClaimReadinessBlockers = vi.fn().mockResolvedValue({
      counts: { open: 1, flagged: 1, pending: 0, total: 2 },
      truncated: false,
      blockers: [
        { visitId: 'v1', reason: 'open', clientName: 'Client A', caregiverName: 'Care One', clockInTime: '2026-06-28T09:00:00Z', clockOutTime: null },
        { visitId: 'v2', reason: 'flagged', clientName: 'Client B', caregiverName: 'Care Two', clockInTime: '2026-06-20T09:00:00Z', clockOutTime: '2026-06-20T13:00:00Z' },
      ],
    });
    spyRepo(() => ({ getClaimReadinessBlockers }));

    const response = await request(createApp())
      .get('/api/compliance-engine/claims/blockers')
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body.counts).toEqual({ open: 1, flagged: 1, pending: 0, total: 2 });
    expect(response.body.blockers).toHaveLength(2);
    expect(response.body.blockers[0].reason).toBe('open');
    expect(getClaimReadinessBlockers).toHaveBeenCalledWith(agencyId);
  });

  it('rejects a caregiver token (lacks billing.read)', async () => {
    const getClaimReadinessBlockers = vi.fn();
    spyRepo(() => ({ getClaimReadinessBlockers }));

    const response = await request(createApp())
      .get('/api/compliance-engine/claims/blockers')
      .set('Authorization', `Bearer ${makeToken('caregiver', agencyId, userId, 'caregiver-1')}`);

    expect(response.status).toBe(403);
    expect(getClaimReadinessBlockers).not.toHaveBeenCalled();
  });
});
