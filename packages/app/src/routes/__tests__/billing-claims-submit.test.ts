import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

const claimId = '00000000-0000-4000-8000-000000000001';

const readyClaim = {
  id: claimId,
  agencyId: 'agency-1',
  clientId: 'client-1',
  payerId: 'PACHC',
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
  status: 'ready' as const,
  totalUnits: 4,
  totalChargeCents: 2128,
  denialRisk: 'low' as const,
  controlNumber: 'ABC123456789',
  payerClaimId: null,
  statusReason: null,
  submittedAt: null,
  lines: [
    {
      id: 'line-1',
      claimId,
      visitId: 'visit-1',
      serviceCode: 'T1019' as const,
      serviceDate: '2026-06-10',
      units: 4,
      minutes: 60,
      chargeCents: 2128,
      denialRisk: 'low' as const,
      denialReasons: [],
    },
  ],
};

const completeProfile = {
  name: 'RayCare LLC',
  npi: '1234567890',
  taxId: '123456789',
  address1: '1 Main St',
  city: 'Pittsburgh',
  state: 'PA',
  postalCode: '15210',
  taxonomyCode: '',
  clearinghouseId: 'CH123',
  medicaidProviderNumber: 'MP123',
};

const sandboxConfig = {
  enabled: true,
  transport: 'sandbox',
  endpoint: null,
  credentials: null,
  settings: {},
};

interface Overrides {
  claim?: unknown;
  profile?: unknown;
  submissionConfig?: unknown;
}

function installMocks(overrides: Overrides = {}) {
  const updateStatus = vi.fn(async (_agency: string, _id: string, patch: Record<string, unknown>) => ({
    ...readyClaim,
    ...patch,
  }));
  const claimRepo = {
    getClaim: vi.fn().mockResolvedValue(overrides.claim === undefined ? readyClaim : overrides.claim),
    updateStatus,
    getAgencyBillingProfile: vi
      .fn()
      .mockResolvedValue(overrides.profile === undefined ? completeProfile : overrides.profile),
    getClientBillingInfo: vi.fn().mockResolvedValue(
      new Map([
        ['client-1', { firstName: 'John', lastName: 'Client', medicaidNumber: 'MA123', dateOfBirth: '1950-01-01' }],
      ]),
    ),
    getVisitRenderingProviders: vi.fn().mockResolvedValue(new Map()),
    listClaims: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
  };
  vi.spyOn(core, 'ClaimRepository').mockImplementation(() => claimRepo as unknown as core.ClaimRepository);

  const findSubmissionConfig = vi
    .fn()
    .mockResolvedValue('submissionConfig' in overrides ? overrides.submissionConfig : sandboxConfig);
  vi.spyOn(core, 'AgencyClearinghouseConfigRepository').mockImplementation(
    () => ({ findSubmissionConfig }) as unknown as core.AgencyClearinghouseConfigRepository,
  );

  const auditCreate = vi.fn().mockResolvedValue({});
  vi.spyOn(core, 'AuditEventRepository').mockImplementation(
    () => ({ create: auditCreate }) as unknown as core.AuditEventRepository,
  );

  return { claimRepo, updateStatus, auditCreate, findSubmissionConfig };
}

describe('POST /billing/claims/:id/submit', () => {
  afterEach(() => vi.restoreAllMocks());

  it('submits a ready claim through the sandbox transport and persists the reference', async () => {
    const { updateStatus, auditCreate } = installMocks();
    const res = await request(createApp())
      .post(`/billing/claims/${claimId}/submit`)
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.reference).toMatch(/^SBX-ABC123456789-\d+$/);
    expect(res.body.status).toBe('submitted');
    expect(res.body.transportReference).toBe(res.body.reference);

    expect(updateStatus).toHaveBeenCalledWith(
      expect.any(String),
      claimId,
      expect.objectContaining({
        status: 'submitted',
        transportReference: expect.stringMatching(/^SBX-/),
        submittedAt: expect.any(String),
      }),
    );

    const eventTypes = auditCreate.mock.calls.map((c) => c[0].eventType);
    expect(eventTypes).toContain('claim.submitted');
    expect(eventTypes).toContain('phi.export');
  });

  it('404s for an unknown claim', async () => {
    installMocks({ claim: null });
    const res = await request(createApp())
      .post(`/billing/claims/${claimId}/submit`)
      .set('Authorization', `Bearer ${makeToken('admin')}`);
    expect(res.status).toBe(404);
  });

  it('422s for a claim not in a submittable status, leaving it untouched', async () => {
    const { updateStatus } = installMocks({ claim: { ...readyClaim, status: 'draft' } });
    const res = await request(createApp())
      .post(`/billing/claims/${claimId}/submit`)
      .set('Authorization', `Bearer ${makeToken('admin')}`);
    expect(res.status).toBe(422);
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('422s with the missing billing profile fields', async () => {
    installMocks({ profile: { ...completeProfile, npi: '' } });
    const res = await request(createApp())
      .post(`/billing/claims/${claimId}/submit`)
      .set('Authorization', `Bearer ${makeToken('admin')}`);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('BILLING_PROFILE_INCOMPLETE');
    expect(res.body.missing).toContain('Billing NPI');
  });

  it('409s when the clearinghouse is not configured', async () => {
    installMocks({ submissionConfig: undefined });
    const res = await request(createApp())
      .post(`/billing/claims/${claimId}/submit`)
      .set('Authorization', `Bearer ${makeToken('admin')}`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLEARINGHOUSE_NOT_CONFIGURED');
  });

  it('502s on a transport error and does not change the claim status', async () => {
    const { updateStatus } = installMocks({
      submissionConfig: { ...sandboxConfig, transport: 'http', endpoint: 'https://api.example.com', credentials: { apiKey: 'k' } },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 503, ok: false, text: async () => '' }),
    );
    const res = await request(createApp())
      .post(`/billing/claims/${claimId}/submit`)
      .set('Authorization', `Bearer ${makeToken('admin')}`);
    vi.unstubAllGlobals();

    expect(res.status).toBe(502);
    expect(res.body.retryable).toBe(true);
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('forbids roles without billing.write', async () => {
    installMocks();
    const res = await request(createApp())
      .post(`/billing/claims/${claimId}/submit`)
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);
    expect(res.status).toBe(403);
  });
});
