import type { EvvVisit } from '../domain/evv.js';
import type { EvvException } from '../domain/evv-exception.js';
import { EvvComplianceService } from './evv-compliance-service.js';
import { PA_GRACE_PERIOD_MINUTES } from '../config/pennsylvania.js';

export type DetectedExceptionType = EvvException['exceptionType'];

export interface DetectedException {
  exceptionType: DetectedExceptionType;
  reason: string;
}

export interface DetectExceptionOptions {
  /** Assignment's scheduled start (ISO). Enables late-clock-in detection. */
  scheduledStartTime?: string | null;
  /**
   * Minutes a caregiver may clock in past the scheduled start before it's a
   * late-clock-in exception. PA's de-minimis grace window is 15 minutes.
   */
  graceMinutes?: number;
  /** GPS accuracy (meters) above which a fix is treated as degraded. */
  accuracyThresholdM?: number;
}

// Single source of truth for the PA de-minimis grace window; previously a
// hardcoded duplicate of the pennsylvania.ts constant.
const DEFAULT_GRACE_MINUTES = PA_GRACE_PERIOD_MINUTES;
const DEFAULT_ACCURACY_THRESHOLD_M = 100;

/**
 * Pure detector that turns a completed (clocked-out) visit into the set of EVV
 * exceptions that must be filed before it can be considered audit-clean. Runs
 * at clock-out so the exception queue is populated from real visit data.
 *
 * Maps to PA's four exception types:
 *  - missing-location  → GPS not captured, or a degraded (>threshold) fix
 *  - late-clock-in     → clocked in beyond the scheduled start + grace window
 *  - manual-entry / telephony-fallback are set by their capture paths, not here.
 */
export function detectVisitExceptions(
  visit: EvvVisit,
  opts: DetectExceptionOptions = {},
): DetectedException[] {
  const graceMinutes = opts.graceMinutes ?? DEFAULT_GRACE_MINUTES;
  const accuracyThresholdM = opts.accuracyThresholdM ?? DEFAULT_ACCURACY_THRESHOLD_M;

  const exceptions: DetectedException[] = [];
  const compliance = new EvvComplianceService().validate(visit);

  // Location element: missing entirely, or captured but degraded.
  if (compliance.missingElements.includes('location')) {
    exceptions.push({
      exceptionType: 'missing-location',
      reason: 'GPS location was not captured at clock-in.',
    });
  } else {
    const inAcc = visit.clockInLocation?.accuracy;
    const outAcc = visit.clockOutLocation?.accuracy;
    if (typeof inAcc === 'number' && inAcc > accuracyThresholdM) {
      exceptions.push({
        exceptionType: 'missing-location',
        reason: `Clock-in GPS accuracy ${Math.round(inAcc)}m exceeds the ${accuracyThresholdM}m threshold.`,
      });
    } else if (typeof outAcc === 'number' && outAcc > accuracyThresholdM) {
      exceptions.push({
        exceptionType: 'missing-location',
        reason: `Clock-out GPS accuracy ${Math.round(outAcc)}m exceeds the ${accuracyThresholdM}m threshold.`,
      });
    }
  }

  // Late clock-in relative to the scheduled start (+ grace).
  if (opts.scheduledStartTime && visit.clockInTime) {
    const scheduled = Date.parse(opts.scheduledStartTime);
    const actual = Date.parse(visit.clockInTime);
    if (!Number.isNaN(scheduled) && !Number.isNaN(actual)) {
      const lateMinutes = Math.round((actual - scheduled) / 60000);
      if (lateMinutes > graceMinutes) {
        exceptions.push({
          exceptionType: 'late-clock-in',
          reason: `Clocked in ${lateMinutes} min after the scheduled start (grace ${graceMinutes} min).`,
        });
      }
    }
  }

  return exceptions;
}
