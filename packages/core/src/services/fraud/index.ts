/**
 * Native fraud-scoring engine — public surface.
 *
 * `scoreVisit(ctx)` runs every registered detector against an assembled
 * `VisitFeatureContext` and fuses the results into one explainable verdict. The
 * context is built separately (see `fraud-context-builder`) so the engine itself
 * touches no database and stays a pure, fast, unit-tested function.
 */
import { impossibleTravelDetector } from './detectors/impossible-travel.js';
import { duplicateVisitDetector } from './detectors/duplicate-visit.js';
import { gpsAnomalyDetector } from './detectors/gps-anomaly.js';
import { abnormalDurationDetector } from './detectors/abnormal-duration.js';
import { fuse, type CompositeScore } from './scoring.js';
import type { Detector, DetectionResult, VisitFeatureContext } from './types.js';

/** The detectors that run on data RayHealthEVV already stores. Order is stable. */
export const DETECTORS: readonly Detector[] = [
  impossibleTravelDetector,
  duplicateVisitDetector,
  gpsAnomalyDetector,
  abnormalDurationDetector,
];

export interface VisitVerdict extends CompositeScore {
  visitId: string;
  /** Every detector's raw result, triggered or not — useful for audit/debug. */
  signals: DetectionResult[];
  /** Detector type → version, so a re-score can be compared to the ruleset that produced it. */
  engineVersions: Record<string, string>;
}

export function scoreVisit(ctx: VisitFeatureContext): VisitVerdict {
  const signals = DETECTORS.map((d) => d.detect(ctx));
  const composite = fuse(signals);
  const engineVersions = Object.fromEntries(DETECTORS.map((d) => [d.type, d.version]));
  return { visitId: ctx.visit.id, ...composite, signals, engineVersions };
}

export * from './types.js';
export * from './scoring.js';
export { speedKmh } from './detectors/impossible-travel.js';
export { FraudContextBuilder } from './fraud-context-builder.js';
