import { haversineMeters } from '../../../security/geofence.js';
import type { Detector, DetectionResult, VisitFeatureContext } from '../types.js';
import { notTriggered } from '../types.js';

/**
 * gps_anomaly — clock-in location vs. the authorized service address geofence.
 *
 *   distance ≤ radius              ⇒ PASS  (no event)
 *   radius < distance ≤ 5× radius  ⇒ FLAG  (moderate severity)
 *   distance > 5× radius           ⇒ FAIL  (high severity)
 *
 * Note: this is the same geofence anchor the clock-in path already enforces;
 * scoring it here turns a pass/fail gate into a graded, explainable signal and
 * catches out-of-radius visits that were let through offline or via maintenance.
 */
export const gpsAnomalyDetector: Detector = {
  type: 'gps_anomaly',
  version: '1.0.0',

  detect(ctx: VisitFeatureContext): DetectionResult {
    const { visit, authorization } = ctx;
    const anchor = authorization?.location;
    if (!anchor || visit.clockInLocation == null) {
      return notTriggered(this.type, 'Insufficient geo data for geofence check');
    }

    const distance = haversineMeters(visit.clockInLocation, anchor);
    const radius = authorization.radiusMeters;

    if (distance <= radius) {
      return notTriggered(this.type, `Inside approved radius (${distance.toFixed(0)}m ≤ ${radius}m)`);
    }

    const major = distance > radius * 5;
    const severity = major
      ? Math.min(100, 75 + Math.round((distance / (radius * 5)) * 5))
      : Math.min(70, 35 + Math.round(((distance - radius) / radius) * 10));

    return {
      type: this.type,
      triggered: true,
      severity,
      explanation:
        `Clock-in was ${distance.toFixed(0)}m from the authorized service address ` +
        `(approved radius ${radius}m). ${major ? 'Major discrepancy ⇒ FAIL.' : 'Outside radius ⇒ FLAG.'}`,
      evidence: {
        distanceMeters: Math.round(distance),
        radiusMeters: radius,
        decision: major ? 'FAIL' : 'FLAG',
      },
    };
  },
};
