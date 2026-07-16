import { describe, expect, it } from 'vitest';
import {
  scoreVisit,
  fuse,
  scoreToStatus,
  scoreToRiskLevel,
  speedKmh,
  DEFAULT_FRAUD_CONFIG,
  type VisitFeatureContext,
  type DetectionResult,
} from './index.js';

// Pittsburgh and Philadelphia — ~490 km apart, a clean impossible-travel pair.
const PITTSBURGH = { lat: 40.4406, lng: -79.9959 };
const PHILLY = { lat: 39.9526, lng: -75.1652 };
const HOUR = 3_600_000;

function baseContext(overrides: Partial<VisitFeatureContext> = {}): VisitFeatureContext {
  return {
    visit: {
      id: 'v-1',
      caregiverId: 'cg-1',
      clientId: 'cl-1',
      serviceCode: 'T1019',
      clockInAtMs: Date.parse('2026-07-16T14:00:00.000Z'),
      clockOutAtMs: Date.parse('2026-07-16T15:00:00.000Z'),
      clockInLocation: PITTSBURGH,
    },
    authorization: { location: PITTSBURGH, radiusMeters: 150 },
    caregiverRecentVisits: [],
    clientRecentVisits: [],
    durationBaseline: { meanMinutes: 60, stdMinutes: 10 },
    config: DEFAULT_FRAUD_CONFIG,
    ...overrides,
  };
}

describe('speedKmh', () => {
  it('computes ground speed and treats instantaneous movement as infinite', () => {
    expect(speedKmh(120_000, HOUR)).toBeCloseTo(120, 5);
    expect(speedKmh(1000, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(speedKmh(0, 0)).toBe(0);
  });
});

describe('impossible_travel detector', () => {
  it('triggers when two clock-ins imply an impossible ground speed', () => {
    const t = Date.parse('2026-07-16T14:00:00.000Z');
    const verdict = scoreVisit(
      baseContext({
        visit: { ...baseContext().visit, clockInAtMs: t, clockInLocation: PITTSBURGH },
        caregiverRecentVisits: [
          // Same caregiver in Philadelphia only 30 minutes earlier → ~980 km/h.
          { id: 'v-0', clockInAtMs: t - 30 * 60_000, clockInLocation: PHILLY },
        ],
      }),
    );
    const sig = verdict.signals.find((s) => s.type === 'impossible_travel')!;
    expect(sig.triggered).toBe(true);
    expect(sig.severity).toBeGreaterThan(60);
    expect(sig.evidence.comparedVisitId).toBe('v-0');
  });

  it('does not trigger for plausible travel', () => {
    const t = Date.parse('2026-07-16T14:00:00.000Z');
    const sig = scoreVisit(
      baseContext({
        caregiverRecentVisits: [
          // Same city, 2 hours earlier → trivially plausible.
          { id: 'v-0', clockInAtMs: t - 2 * HOUR, clockInLocation: { lat: 40.45, lng: -80.0 } },
        ],
      }),
    ).signals.find((s) => s.type === 'impossible_travel')!;
    expect(sig.triggered).toBe(false);
  });
});

describe('duplicate_visit detector', () => {
  it('flags a different caregiver clocking in for the same client within the window (severity 80)', () => {
    const t = Date.parse('2026-07-16T14:00:00.000Z');
    const sig = scoreVisit(
      baseContext({
        visit: { ...baseContext().visit, clockInAtMs: t },
        clientRecentVisits: [{ id: 'v-9', caregiverId: 'cg-OTHER', clockInAtMs: t + 5 * 60_000 }],
      }),
    ).signals.find((s) => s.type === 'duplicate_visit')!;
    expect(sig.triggered).toBe(true);
    expect(sig.severity).toBe(80);
    expect(sig.evidence.differentCaregiver).toBe(true);
  });

  it('does not flag visits outside the duplicate window', () => {
    const t = Date.parse('2026-07-16T14:00:00.000Z');
    const sig = scoreVisit(
      baseContext({
        visit: { ...baseContext().visit, clockInAtMs: t },
        clientRecentVisits: [{ id: 'v-9', caregiverId: 'cg-OTHER', clockInAtMs: t + 2 * HOUR }],
      }),
    ).signals.find((s) => s.type === 'duplicate_visit')!;
    expect(sig.triggered).toBe(false);
  });
});

describe('gps_anomaly detector', () => {
  it('fails a clock-in far outside the authorized radius', () => {
    const sig = scoreVisit(
      baseContext({
        visit: { ...baseContext().visit, clockInLocation: PHILLY },
        authorization: { location: PITTSBURGH, radiusMeters: 150 },
      }),
    ).signals.find((s) => s.type === 'gps_anomaly')!;
    expect(sig.triggered).toBe(true);
    expect(sig.evidence.decision).toBe('FAIL');
  });

  it('passes a clock-in inside the radius', () => {
    const sig = scoreVisit(baseContext()).signals.find((s) => s.type === 'gps_anomaly')!;
    expect(sig.triggered).toBe(false);
  });
});

describe('abnormal_duration detector', () => {
  it('hard-floors a sub-2-minute visit even without a baseline', () => {
    const t = Date.parse('2026-07-16T14:00:00.000Z');
    const sig = scoreVisit(
      baseContext({
        visit: { ...baseContext().visit, clockInAtMs: t, clockOutAtMs: t + 60_000 },
        durationBaseline: null,
      }),
    ).signals.find((s) => s.type === 'abnormal_duration')!;
    expect(sig.triggered).toBe(true);
    expect(sig.evidence.rule).toBe('hard_floor_2min');
  });

  it('triggers on a |z| >= 3 duration outlier', () => {
    const t = Date.parse('2026-07-16T14:00:00.000Z');
    const sig = scoreVisit(
      baseContext({
        visit: { ...baseContext().visit, clockInAtMs: t, clockOutAtMs: t + 120 * 60_000 },
        durationBaseline: { meanMinutes: 60, stdMinutes: 10 }, // z = 6
      }),
    ).signals.find((s) => s.type === 'abnormal_duration')!;
    expect(sig.triggered).toBe(true);
    expect(sig.evidence.zScore).toBe(6);
  });

  it('does not trigger a normal-length visit', () => {
    const sig = scoreVisit(baseContext()).signals.find((s) => s.type === 'abnormal_duration')!;
    expect(sig.triggered).toBe(false);
  });
});

describe('fuse / scoring', () => {
  const sig = (severity: number, type: DetectionResult['type'] = 'impossible_travel'): DetectionResult => ({
    type,
    triggered: severity > 0,
    severity,
    explanation: 'x',
    evidence: {},
  });

  it('returns a clean verdict when nothing triggered', () => {
    const c = fuse([sig(0), sig(0, 'gps_anomaly')]);
    expect(c).toMatchObject({ score: 0, status: 'verified', riskLevel: 'low', triggeredCount: 0 });
  });

  it('lets a single strong signal score high', () => {
    expect(fuse([sig(90)]).score).toBeGreaterThanOrEqual(70);
  });

  it('rewards multiple independent signals (noisy-OR) above any single one', () => {
    const single = fuse([sig(60)]).score;
    const multi = fuse([sig(60), sig(60, 'duplicate_visit'), sig(60, 'gps_anomaly')]).score;
    expect(multi).toBeGreaterThan(single);
    expect(multi).toBeLessThanOrEqual(100);
  });

  it('sorts factors by contribution and never exceeds 100', () => {
    const c = fuse([sig(30, 'abnormal_duration'), sig(95)]);
    expect(c.factors[0].type).toBe('impossible_travel');
    expect(c.score).toBeLessThanOrEqual(100);
  });

  it('maps scores to risk levels and statuses at the boundaries', () => {
    expect(scoreToRiskLevel(24)).toBe('low');
    expect(scoreToRiskLevel(25)).toBe('medium');
    expect(scoreToRiskLevel(50)).toBe('high');
    expect(scoreToRiskLevel(75)).toBe('critical');
    expect(scoreToStatus(29)).toBe('verified');
    expect(scoreToStatus(30)).toBe('review');
    expect(scoreToStatus(70)).toBe('rejected');
  });
});

describe('scoreVisit orchestrator', () => {
  it('produces a verified verdict for a clean visit and always returns all four signals', () => {
    const verdict = scoreVisit(baseContext());
    expect(verdict.status).toBe('verified');
    expect(verdict.score).toBe(0);
    expect(verdict.signals).toHaveLength(4);
    expect(Object.keys(verdict.engineVersions)).toHaveLength(4);
  });

  it('escalates a visit that trips multiple detectors', () => {
    const t = Date.parse('2026-07-16T14:00:00.000Z');
    const verdict = scoreVisit(
      baseContext({
        visit: {
          ...baseContext().visit,
          clockInAtMs: t,
          clockOutAtMs: t + 60_000, // 1 min → abnormal duration hard floor
          clockInLocation: PHILLY, // far from Pittsburgh anchor → gps anomaly
        },
        caregiverRecentVisits: [{ id: 'v-0', clockInAtMs: t - 20 * 60_000, clockInLocation: PITTSBURGH }],
      }),
    );
    expect(verdict.triggeredCount).toBeGreaterThanOrEqual(2);
    expect(['review', 'rejected']).toContain(verdict.status);
  });
});
