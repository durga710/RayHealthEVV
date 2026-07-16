import type { Detector, DetectionResult, VisitFeatureContext } from '../types.js';
import { notTriggered } from '../types.js';

/**
 * duplicate_visit — the same client has another clock-in within a short window
 * (possible double-billing or split claim). Distinct caregivers clocking in for
 * one client at overlapping times is a stronger signal than the same caregiver
 * (which is more often a correction than fraud).
 */
export const duplicateVisitDetector: Detector = {
  type: 'duplicate_visit',
  version: '1.0.0',

  detect(ctx: VisitFeatureContext): DetectionResult {
    const { visit, clientRecentVisits, config } = ctx;
    if (visit.clockInAtMs == null) return notTriggered(this.type, 'No clock-in time');

    const windowMs = config.duplicateWindowMin * 60_000;
    const t = visit.clockInAtMs;

    const dupes = clientRecentVisits.filter(
      (v) => v.id !== visit.id && v.clockInAtMs != null && Math.abs(v.clockInAtMs - t) <= windowMs,
    );

    if (dupes.length === 0) {
      return notTriggered(this.type, 'No overlapping visits for this client');
    }

    const differentCaregiver = dupes.some((d) => d.caregiverId !== visit.caregiverId);
    const severity = differentCaregiver ? 80 : 55;

    return {
      type: this.type,
      triggered: true,
      severity,
      explanation:
        `Client has ${dupes.length} other clock-in(s) within ${config.duplicateWindowMin} ` +
        `minutes${differentCaregiver ? ' by a different caregiver' : ''} — possible duplicate/double-billing.`,
      evidence: {
        windowMinutes: config.duplicateWindowMin,
        duplicateVisitIds: dupes.map((d) => d.id),
        differentCaregiver,
      },
    };
  },
};
