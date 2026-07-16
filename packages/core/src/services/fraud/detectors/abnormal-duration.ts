import type { Detector, DetectionResult, VisitFeatureContext } from '../types.js';
import { notTriggered } from '../types.js';

/**
 * abnormal_duration — visit length deviates sharply from the baseline for its
 * service code (z-score). Catches near-instant "drive-by" visits and implausibly
 * long ones inflating billed units.
 *
 *   z = (duration − mean) / std ; |z| ≥ 3 ⇒ anomaly
 *
 * A hard floor also flags any completed visit under 2 minutes regardless of
 * baseline, so a brand-new service code with no history still catches drive-bys.
 */
export const abnormalDurationDetector: Detector = {
  type: 'abnormal_duration',
  version: '1.0.0',

  detect(ctx: VisitFeatureContext): DetectionResult {
    const { visit, durationBaseline } = ctx;
    const duration = deriveDuration(visit.clockInAtMs, visit.clockOutAtMs);
    if (duration == null) return notTriggered(this.type, 'No duration available');

    if (duration < 2) {
      return {
        type: this.type,
        triggered: true,
        severity: 70,
        explanation: `Visit lasted only ${duration.toFixed(1)} min — implausibly short for a service visit.`,
        evidence: { durationMinutes: +duration.toFixed(2), rule: 'hard_floor_2min' },
      };
    }

    if (!durationBaseline || durationBaseline.stdMinutes <= 0) {
      return notTriggered(this.type, 'No baseline to compare duration');
    }

    const z = (duration - durationBaseline.meanMinutes) / durationBaseline.stdMinutes;
    if (Math.abs(z) < 3) {
      return notTriggered(this.type, `Duration within normal range (z=${z.toFixed(2)})`);
    }

    const severity = Math.min(100, 40 + Math.round((Math.abs(z) - 3) * 15));
    return {
      type: this.type,
      triggered: true,
      severity,
      explanation:
        `Visit duration ${duration.toFixed(0)} min is ${z > 0 ? 'far above' : 'far below'} the ` +
        `baseline for this service (mean ${durationBaseline.meanMinutes.toFixed(0)} min, z=${z.toFixed(1)}).`,
      evidence: {
        durationMinutes: +duration.toFixed(1),
        baselineMean: +durationBaseline.meanMinutes.toFixed(1),
        baselineStd: +durationBaseline.stdMinutes.toFixed(1),
        zScore: +z.toFixed(2),
      },
    };
  },
};

function deriveDuration(startMs: number | null, endMs: number | null): number | null {
  if (startMs == null || endMs == null) return null;
  return (endMs - startMs) / 60_000;
}
