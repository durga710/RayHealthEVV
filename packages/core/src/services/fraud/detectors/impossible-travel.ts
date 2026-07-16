import { haversineMeters } from '../../../security/geofence.js';
import type { Detector, DetectionResult, VisitFeatureContext } from '../types.js';
import { notTriggered } from '../types.js';

/** Ground speed in km/h implied by covering `meters` in `deltaMs`. Infinity if instantaneous. */
export function speedKmh(meters: number, deltaMs: number): number {
  if (deltaMs <= 0) return meters > 0 ? Number.POSITIVE_INFINITY : 0;
  return meters / 1000 / (deltaMs / 3_600_000);
}

/**
 * impossible_travel — the caregiver appears at two locations too far apart to
 * have plausibly traveled between in the elapsed time (e.g. two clock-ins 300 km
 * apart, 20 minutes apart ⇒ ~900 km/h ⇒ impossible by ground transport).
 *
 *   impliedSpeed = haversine(prev, curr) / (t_curr − t_prev)
 *   triggered    = impliedSpeed > config.impossibleTravelKmh
 */
export const impossibleTravelDetector: Detector = {
  type: 'impossible_travel',
  version: '1.0.0',

  detect(ctx: VisitFeatureContext): DetectionResult {
    const { visit, caregiverRecentVisits, config } = ctx;
    if (visit.clockInAtMs == null || visit.clockInLocation == null) {
      return notTriggered(this.type, 'No clock-in geo to compare');
    }
    const curr = { t: visit.clockInAtMs, loc: visit.clockInLocation };

    let worst: { speed: number; distance: number; deltaMin: number; otherVisitId: string } | null =
      null;

    for (const prev of caregiverRecentVisits) {
      if (prev.id === visit.id || prev.clockInAtMs == null || prev.clockInLocation == null) continue;
      const distance = haversineMeters(curr.loc, prev.clockInLocation);
      const dt = Math.abs(curr.t - prev.clockInAtMs);
      const speed = speedKmh(distance, dt);
      if (!worst || speed > worst.speed) {
        worst = { speed, distance, deltaMin: dt / 60_000, otherVisitId: prev.id };
      }
    }

    if (!worst || worst.speed <= config.impossibleTravelKmh) {
      return notTriggered(this.type, 'Travel between visits is physically plausible');
    }

    // Severity scales with how far the implied speed exceeds the threshold.
    const ratio = worst.speed / config.impossibleTravelKmh;
    const severity = Math.min(100, Math.round(60 + (ratio - 1) * 40));

    return {
      type: this.type,
      triggered: true,
      severity,
      explanation:
        `Implied travel speed of ${worst.speed.toFixed(0)} km/h between consecutive ` +
        `clock-ins (${(worst.distance / 1000).toFixed(1)} km in ${worst.deltaMin.toFixed(0)} min) ` +
        `exceeds the plausible threshold of ${config.impossibleTravelKmh} km/h.`,
      evidence: {
        impliedSpeedKmh: Number.isFinite(worst.speed) ? Math.round(worst.speed) : 'instantaneous',
        distanceKm: +(worst.distance / 1000).toFixed(2),
        deltaMinutes: +worst.deltaMin.toFixed(1),
        thresholdKmh: config.impossibleTravelKmh,
        comparedVisitId: worst.otherVisitId,
      },
    };
  },
};
