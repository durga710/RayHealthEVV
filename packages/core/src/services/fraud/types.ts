/**
 * Native visit fraud-scoring engine.
 *
 * Ported from the standalone RayVerify service's detector design so RayHealthEVV
 * can score visits on the data it already stores — no external service, no new
 * PHI leaving the tenant. Each detector is a PURE function of a
 * `VisitFeatureContext` (assembled once, by the context builder) so detectors
 * stay unit-testable with zero DB access.
 *
 * Only the four detectors that run on data we already capture are implemented:
 * impossible-travel, duplicate-visit, gps-anomaly, abnormal-duration. Two more
 * from the RayVerify catalog (shared-device, identity-mismatch) need a device id
 * and a biometric provider we do not have yet — they remain roadmap and are
 * deliberately NOT faked here.
 */

/** Signals implemented today. The union is intentionally closed to what is real. */
export type FraudSignalType =
  | 'impossible_travel'
  | 'duplicate_visit'
  | 'gps_anomaly'
  | 'abnormal_duration';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/** Verdict a reviewer acts on: clean, needs a look, or presumptively bad. */
export type FraudStatus = 'verified' | 'review' | 'rejected';

/** One detector's finding. `severity` is its 0–100 contribution before fusion. */
export interface DetectionResult {
  type: FraudSignalType;
  triggered: boolean;
  /** 0 when not triggered; otherwise 1–100. */
  severity: number;
  /** Plain-English reason — the explainability requirement, shown to reviewers. */
  explanation: string;
  /** Structured evidence for the audit trail / support. Never contains raw PHI. */
  evidence: Record<string, unknown>;
}

/**
 * A minimal, non-PHI location. Detectors only ever see coordinates + times, not
 * client names, addresses, or Medicaid identifiers.
 */
export interface FraudLocation {
  lat: number;
  lng: number;
}

/**
 * Point-in-time view of a completed visit plus the caregiver/client history a
 * detector needs. Assembled by the context builder from EVV + client data; all
 * timestamps are epoch milliseconds so detectors do no date parsing.
 */
export interface VisitFeatureContext {
  visit: {
    id: string;
    caregiverId: string;
    clientId: string | null;
    serviceCode: string | null;
    clockInAtMs: number | null;
    clockOutAtMs: number | null;
    clockInLocation: FraudLocation | null;
  };
  /** The client's authorized service address + geofence anchor, when known. */
  authorization: {
    location: FraudLocation | null;
    radiusMeters: number;
  } | null;
  /** Same-caregiver visits in the lookback window (impossible-travel). */
  caregiverRecentVisits: Array<{
    id: string;
    clockInAtMs: number | null;
    clockInLocation: FraudLocation | null;
  }>;
  /** Same-client visits in the lookback window (duplicate detection). */
  clientRecentVisits: Array<{
    id: string;
    caregiverId: string;
    clockInAtMs: number | null;
  }>;
  /** Mean/std of completed-visit durations for this service code, for the z-score. */
  durationBaseline: { meanMinutes: number; stdMinutes: number } | null;
  config: FraudConfig;
}

/** Tunable thresholds. Agency-overridable later; these are the sane defaults. */
export interface FraudConfig {
  /** Implied ground-speed above which travel between clock-ins is impossible. */
  impossibleTravelKmh: number;
  /** Window in which a second clock-in for the same client counts as a duplicate. */
  duplicateWindowMin: number;
}

export const DEFAULT_FRAUD_CONFIG: FraudConfig = {
  impossibleTravelKmh: 120,
  duplicateWindowMin: 30,
};

export interface Detector {
  readonly type: FraudSignalType;
  readonly version: string;
  detect(ctx: VisitFeatureContext): DetectionResult;
}

/** Helper for the common "nothing to see here" return. */
export function notTriggered(type: FraudSignalType, reason: string): DetectionResult {
  return { type, severity: 0, triggered: false, explanation: reason, evidence: {} };
}
