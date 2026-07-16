import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

const visitId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

const PITTSBURGH = { lat: 40.4406, lng: -79.9959 };
const PHILLY = { lat: 39.9526, lng: -75.1652 };

/** A context that trips gps_anomaly (clock-in far from the authorized anchor). */
function flaggableContext(id = visitId): core.VisitFeatureContext {
  const t = Date.parse('2026-07-16T14:00:00.000Z');
  return {
    visit: {
      id,
      caregiverId: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
      clientId: 'dddddddd-dddd-4ddd-dddd-dddddddddddd',
      serviceCode: 'T1019',
      clockInAtMs: t,
      clockOutAtMs: t + 60 * 60_000,
      clockInLocation: PHILLY,
    },
    authorization: { location: PITTSBURGH, radiusMeters: 150 },
    caregiverRecentVisits: [],
    clientRecentVisits: [],
    durationBaseline: { meanMinutes: 60, stdMinutes: 10 },
    config: core.DEFAULT_FRAUD_CONFIG,
  };
}

beforeAll(() => setTestJwtSecret());

describe('fraud routes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('forbids a role without evv.read (family)', async () => {
    const res = await request(createApp())
      .get(`/fraud/visits/${visitId}`)
      .set('Authorization', `Bearer ${makeToken('family')}`);
    expect(res.status).toBe(403);
  });

  it('rejects a non-uuid visit id', async () => {
    const res = await request(createApp())
      .get('/fraud/visits/not-a-uuid')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when the visit is not in the agency', async () => {
    vi.spyOn(core, 'FraudContextBuilder').mockImplementation(
      () => ({ build: vi.fn().mockResolvedValue(null) }) as any,
    );
    const res = await request(createApp())
      .get(`/fraud/visits/${visitId}`)
      .set('Authorization', `Bearer ${makeToken('admin')}`);
    expect(res.status).toBe(404);
  });

  it('scores a visit and returns an explainable verdict', async () => {
    vi.spyOn(core, 'FraudContextBuilder').mockImplementation(
      () => ({ build: vi.fn().mockResolvedValue(flaggableContext()) }) as any,
    );
    const res = await request(createApp())
      .get(`/fraud/visits/${visitId}`)
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.verdict.visitId).toBe(visitId);
    expect(res.body.verdict.signals).toHaveLength(4);
    expect(res.body.verdict.score).toBeGreaterThan(0);
    const gps = res.body.verdict.signals.find((s: any) => s.type === 'gps_anomaly');
    expect(gps.triggered).toBe(true);
  });

  it('sweeps recent completed visits and returns only those at/above minScore', async () => {
    vi.spyOn(core, 'EvvRepository').mockImplementation(
      () =>
        ({
          getVisitsForAgency: vi.fn().mockResolvedValue([
            { id: visitId, clockOutTime: '2026-07-16T15:00:00.000Z' },
            { id: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee', clockOutTime: null }, // still open → skipped
          ]),
        }) as any,
    );
    vi.spyOn(core, 'FraudContextBuilder').mockImplementation(
      () => ({ build: vi.fn().mockResolvedValue(flaggableContext()) }) as any,
    );

    const res = await request(createApp())
      .get('/fraud/flagged?minScore=1')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.scannedCount).toBe(1); // the open visit was excluded
    expect(res.body.flaggedCount).toBe(1);
    expect(res.body.verdicts[0].visitId).toBe(visitId);
  });
});
