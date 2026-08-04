import { afterEach, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import {
  AGGREGATOR_SWEEP_ACTOR_ID,
  runAggregatorSubmissionSweep,
  submitAgencyVisits,
  toVisitSubmissions,
} from '../aggregator-submission-service.js';

const db = {} as never;

const sandataConfig = {
  enabled: true,
  apiBaseUrl: 'https://uat-api.example.com/interface/v3',
  providerId: '123456789',
  credentials: { apiKey: 'test-key' },
  caregivers: [],
  services: [],
};

const hhaConfig = {
  enabled: true,
  apiBaseUrl: 'https://api.hhaexchange.example.com',
  agencyTaxId: '00-0000000',
  hhaProviderId: 'HHA-1',
  credentials: { apiKey: 'test-key' },
};

function visitRow(overrides: Partial<core.ExportVisitRow> = {}): core.ExportVisitRow {
  return {
    visitId: 'visit-1',
    serviceCode: 'W1793',
    clientId: 'client-1',
    caregiverId: 'caregiver-1',
    clockInTime: '2026-08-01T13:00:00.000Z',
    clockOutTime: '2026-08-01T17:00:00.000Z',
    clockInLocation: { lat: 40.44, lng: -79.99 },
    clockOutLocation: { lat: 40.44, lng: -79.99 },
    status: 'verified',
    ...overrides,
  };
}

interface EvvMocks {
  pending: ReturnType<typeof vi.fn>;
  markSandata: ReturnType<typeof vi.fn>;
  markHha: ReturnType<typeof vi.fn>;
}

function installMocks(options: {
  sandataAgencies?: string[];
  hhaAgencies?: string[];
  pendingByAgency?: Record<string, core.ExportVisitRow[]>;
  sandataResult?: unknown;
  hhaResult?: unknown;
  sandataConfigOverride?: unknown;
}): EvvMocks {
  vi.spyOn(core, 'AgencySandataConfigRepository').mockImplementation(
    () =>
      ({
        listSubmittableAgencyIds: vi.fn().mockResolvedValue(options.sandataAgencies ?? []),
        findSubmissionConfig: vi
          .fn()
          .mockResolvedValue(
            'sandataConfigOverride' in options ? options.sandataConfigOverride : sandataConfig,
          ),
      }) as unknown as core.AgencySandataConfigRepository,
  );

  vi.spyOn(core, 'AgencyHhaexchangeConfigRepository').mockImplementation(
    () =>
      ({
        listSubmittableAgencyIds: vi.fn().mockResolvedValue(options.hhaAgencies ?? []),
        findSubmissionConfig: vi.fn().mockResolvedValue(hhaConfig),
      }) as unknown as core.AgencyHhaexchangeConfigRepository,
  );

  const pending = vi.fn(async (agencyId: string) => options.pendingByAgency?.[agencyId] ?? []);
  const markSandata = vi.fn().mockResolvedValue(undefined);
  const markHha = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(core, 'EvvRepository').mockImplementation(
    () =>
      ({
        getVisitsPendingAggregatorSubmission: pending,
        markSandataSubmission: markSandata,
        markHhaexchangeSubmission: markHha,
      }) as unknown as core.EvvRepository,
  );

  vi.spyOn(core, 'AuditEventRepository').mockImplementation(
    () => ({ create: vi.fn().mockResolvedValue(undefined) }) as unknown as core.AuditEventRepository,
  );

  vi.spyOn(core.SandataClient, 'submitVisits').mockResolvedValue(
    (options.sandataResult ?? {
      kind: 'ok',
      batchId: 'batch-s1',
      acks: [{ visitId: 'visit-1', status: 'accepted', confirmationId: 'CONF-1' }],
    }) as never,
  );
  vi.spyOn(core.HhaexchangeClient, 'submitVisits').mockResolvedValue(
    (options.hhaResult ?? {
      kind: 'ok',
      batchId: 'batch-h1',
      acks: [{ visitId: 'visit-1', status: 'submitted' }],
    }) as never,
  );

  return { pending, markSandata, markHha };
}

afterEach(() => vi.restoreAllMocks());

describe('toVisitSubmissions', () => {
  it('marks a visit without clock-in coordinates as manual verification', () => {
    const [gps] = toVisitSubmissions([visitRow()]);
    const [manual] = toVisitSubmissions([visitRow({ clockInLocation: null })]);
    expect(gps.verificationMethod).toBe('gps');
    expect(manual.verificationMethod).toBe('manual');
    expect(manual.clockInLat).toBeNull();
  });
});

describe('submitAgencyVisits', () => {
  it('sends nothing and reports not_configured when the agency has no config', async () => {
    installMocks({ sandataConfigOverride: undefined });
    const result = await submitAgencyVisits(db, 'agency-1', 'sandata', [visitRow()], {
      actorId: 'user-1',
      actorType: 'user',
      source: 'manual',
    });
    expect(result.kind).toBe('not_configured');
    expect(core.SandataClient.submitVisits).not.toHaveBeenCalled();
  });

  it('does not load visits at all when the agency is not configured', async () => {
    installMocks({ sandataConfigOverride: undefined });
    const loader = vi.fn().mockResolvedValue([visitRow()]);
    const result = await submitAgencyVisits(db, 'agency-1', 'sandata', loader, {
      actorId: 'user-1',
      actorType: 'user',
      source: 'manual',
    });
    expect(result.kind).toBe('not_configured');
    expect(loader).not.toHaveBeenCalled();
  });

  it('records each acknowledgment against the originating visit', async () => {
    const mocks = installMocks({});
    const result = await submitAgencyVisits(db, 'agency-1', 'sandata', [visitRow()], {
      actorId: 'user-1',
      actorType: 'user',
      source: 'manual',
    });
    expect(result).toMatchObject({ kind: 'ok', batchId: 'batch-s1', accepted: 1, rejected: 0 });
    expect(mocks.markSandata).toHaveBeenCalledWith('visit-1', 'agency-1', 'accepted', 'CONF-1');
  });

  it('still calls the transport on an empty batch so an unimplemented one answers honestly', async () => {
    installMocks({ hhaResult: { kind: 'error', message: 'not implemented', retryable: false } });
    const result = await submitAgencyVisits(db, 'agency-1', 'hhaexchange', [], {
      actorId: 'user-1',
      actorType: 'user',
      source: 'manual',
    });
    expect(core.HhaexchangeClient.submitVisits).toHaveBeenCalledWith(expect.anything(), []);
    expect(result).toMatchObject({ kind: 'error', reason: 'not implemented' });
  });

  it('surfaces a transport failure as a retryable error without marking visits', async () => {
    const mocks = installMocks({
      sandataResult: { kind: 'error', message: 'connection reset', retryable: true },
    });
    const result = await submitAgencyVisits(db, 'agency-1', 'sandata', [visitRow()], {
      actorId: 'user-1',
      actorType: 'user',
      source: 'manual',
    });
    expect(result).toMatchObject({ kind: 'error', retryable: true });
    expect(mocks.markSandata).not.toHaveBeenCalled();
  });
});

describe('runAggregatorSubmissionSweep', () => {
  it('submits pending visits for every configured agency', async () => {
    const mocks = installMocks({
      sandataAgencies: ['agency-1', 'agency-2'],
      pendingByAgency: { 'agency-1': [visitRow()], 'agency-2': [visitRow({ visitId: 'visit-2' })] },
    });
    const summary = await runAggregatorSubmissionSweep(db, { aggregators: ['sandata'] });
    expect(summary.agenciesProcessed).toBe(2);
    expect(summary.visitsAccepted).toBe(2);
    expect(summary.errors).toEqual([]);
    expect(mocks.pending).toHaveBeenCalledTimes(2);
  });

  it('skips agencies with nothing pending without calling the aggregator', async () => {
    installMocks({ sandataAgencies: ['agency-1'], pendingByAgency: {} });
    const summary = await runAggregatorSubmissionSweep(db, { aggregators: ['sandata'] });
    expect(summary.agenciesProcessed).toBe(0);
    expect(core.SandataClient.submitVisits).not.toHaveBeenCalled();
  });

  it('records the sweep as a system actor, not a user', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    installMocks({ sandataAgencies: ['agency-1'], pendingByAgency: { 'agency-1': [visitRow()] } });
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      () => ({ create }) as unknown as core.AuditEventRepository,
    );
    await runAggregatorSubmissionSweep(db, { aggregators: ['sandata'] });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'system',
        actorId: AGGREGATOR_SWEEP_ACTOR_ID,
        payload: expect.objectContaining({ source: 'sweep' }),
      }),
    );
  });

  it('keeps going when one agency fails and reports it', async () => {
    installMocks({
      sandataAgencies: ['agency-1', 'agency-2'],
      pendingByAgency: { 'agency-1': [visitRow()], 'agency-2': [visitRow({ visitId: 'visit-2' })] },
    });
    vi.spyOn(core.SandataClient, 'submitVisits')
      .mockRejectedValueOnce(new Error('aggregator unreachable'))
      .mockResolvedValueOnce({
        kind: 'ok',
        batchId: 'batch-s2',
        acks: [{ visitId: 'visit-2', status: 'accepted' }],
      } as never);

    const summary = await runAggregatorSubmissionSweep(db, { aggregators: ['sandata'] });
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toContain('agency-1');
    expect(summary.visitsAccepted).toBe(1);
  });

  it('restricts the sweep to the requested agencies', async () => {
    const mocks = installMocks({
      sandataAgencies: ['agency-1', 'agency-2'],
      pendingByAgency: { 'agency-1': [visitRow()], 'agency-2': [visitRow()] },
    });
    await runAggregatorSubmissionSweep(db, { aggregators: ['sandata'], agencyIds: ['agency-2'] });
    expect(mocks.pending).toHaveBeenCalledTimes(1);
    expect(mocks.pending).toHaveBeenCalledWith('agency-2', 'sandata', expect.anything());
  });

  it('counts an agency once when it is swept for both aggregators', async () => {
    installMocks({
      sandataAgencies: ['agency-1'],
      hhaAgencies: ['agency-1'],
      pendingByAgency: { 'agency-1': [visitRow()] },
    });
    const summary = await runAggregatorSubmissionSweep(db);
    expect(summary.agenciesProcessed).toBe(1);
    expect(summary.visitsAccepted).toBe(1); // sandata
    expect(summary.visitsSubmitted).toBe(1); // hhaexchange ack is 'submitted'
  });

  it('bounds the queue with a lookback window', async () => {
    const mocks = installMocks({
      sandataAgencies: ['agency-1'],
      pendingByAgency: { 'agency-1': [visitRow()] },
    });
    await runAggregatorSubmissionSweep(db, {
      aggregators: ['sandata'],
      lookbackDays: 10,
      now: new Date('2026-08-04T00:00:00.000Z'),
    });
    expect(mocks.pending).toHaveBeenCalledWith(
      'agency-1',
      'sandata',
      expect.objectContaining({ sinceIso: '2026-07-25T00:00:00.000Z' }),
    );
  });

  it('stops and flags a timeout when the deadline has passed', async () => {
    installMocks({
      sandataAgencies: ['agency-1'],
      pendingByAgency: { 'agency-1': [visitRow()] },
    });
    const summary = await runAggregatorSubmissionSweep(db, {
      aggregators: ['sandata'],
      deadlineMs: Date.now() - 1,
    });
    expect(summary.timedOut).toBe(true);
    expect(core.SandataClient.submitVisits).not.toHaveBeenCalled();
  });
});
