import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSandataApiPayload,
  submitVisits,
  type SandataClientConfig,
} from '../integrations/sandata-client.js';
import type { VisitSubmission } from '../integrations/types.js';

function baseConfig(overrides: Partial<SandataClientConfig> = {}): SandataClientConfig {
  return {
    enabled: true,
    apiBaseUrl: 'https://sandbox.sandata.example/v1',
    providerId: '123456789',
    credentials: { apiKey: 'test-key' },
    caregivers: [{ caregiverId: 'cg-1', externalWorkerId: 'W-100' }],
    services: [{ internalServiceCode: 'PCA', hcpcsCode: 'T1019', hcpcsModifier: 'U2', label: 'Personal care' }],
    ...overrides,
  };
}

const visit: VisitSubmission = {
  visitId: 'v-1',
  clientId: 'client-1',
  caregiverId: 'cg-1',
  serviceCode: 'PCA',
  clockInAt: '2026-06-01T13:00:00.000Z',
  clockOutAt: '2026-06-01T17:00:00.000Z',
  clockInLat: 40.1,
  clockInLng: -75.1,
  clockOutLat: 40.1,
  clockOutLng: -75.1,
  verificationMethod: 'gps',
};

function fetchReturning(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sandata client gating', () => {
  it('is not_configured when disabled', async () => {
    const res = await submitVisits(baseConfig({ enabled: false }), [visit]);
    expect(res.kind).toBe('not_configured');
  });

  it('is not_configured without an API base URL', async () => {
    const res = await submitVisits(baseConfig({ apiBaseUrl: null }), [visit]);
    expect(res.kind).toBe('not_configured');
  });

  it('is not_configured without credentials', async () => {
    const res = await submitVisits(baseConfig({ credentials: null }), [visit]);
    expect(res.kind).toBe('not_configured');
  });
});

describe('sandata payload mapping', () => {
  it('maps a mapped visit and skips unmapped caregiver/service', () => {
    const config = baseConfig();
    const unmappedWorker: VisitSubmission = { ...visit, visitId: 'v-2', caregiverId: 'cg-x' };
    const unmappedService: VisitSubmission = { ...visit, visitId: 'v-3', serviceCode: 'XYZ' };
    const { payload, skipped } = buildSandataApiPayload(config, [visit, unmappedWorker, unmappedService]);

    expect(payload.visits).toHaveLength(1);
    expect(payload.visits[0]).toMatchObject({
      visitOtherId: 'v-1',
      employeeOtherId: 'W-100',
      serviceCode: 'T1019',
      serviceModifier: 'U2',
    });
    expect(skipped.map((s) => s.visitId).sort()).toEqual(['v-2', 'v-3']);
    expect(skipped.every((s) => s.status === 'rejected')).toBe(true);
  });
});

describe('sandata submission', () => {
  it('returns ok with per-visit acks on a 200 response', async () => {
    vi.stubGlobal(
      'fetch',
      fetchReturning(200, { batchId: 'B-1', results: [{ visitOtherId: 'v-1', status: 'accepted', confirmationId: 'C-1' }] }),
    );
    const res = await submitVisits(baseConfig(), [visit]);
    expect(res).toMatchObject({ kind: 'ok', batchId: 'B-1' });
    if (res.kind === 'ok') {
      expect(res.acks).toContainEqual({ visitId: 'v-1', status: 'accepted', confirmationId: 'C-1', error: undefined });
    }
  });

  it('defaults sent visits to submitted when the response has no per-visit results', async () => {
    vi.stubGlobal('fetch', fetchReturning(200, { batchId: 'B-2' }));
    const res = await submitVisits(baseConfig(), [visit]);
    expect(res.kind).toBe('ok');
    if (res.kind === 'ok') expect(res.acks[0]).toMatchObject({ visitId: 'v-1', status: 'submitted' });
  });

  it('returns a retryable error on a 500', async () => {
    vi.stubGlobal('fetch', fetchReturning(500, 'upstream error'));
    const res = await submitVisits(baseConfig(), [visit]);
    expect(res).toMatchObject({ kind: 'error', retryable: true });
  });

  it('returns a non-retryable error on a 401', async () => {
    vi.stubGlobal('fetch', fetchReturning(401, 'unauthorized'));
    const res = await submitVisits(baseConfig(), [visit]);
    expect(res).toMatchObject({ kind: 'error', retryable: false });
  });

  it('returns a retryable error when the network throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
    const res = await submitVisits(baseConfig(), [visit]);
    expect(res).toMatchObject({ kind: 'error', retryable: true });
  });

  it('does not call the network when nothing is mappable', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await submitVisits(baseConfig(), [{ ...visit, caregiverId: 'cg-x' }]);
    expect(res.kind).toBe('ok');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
