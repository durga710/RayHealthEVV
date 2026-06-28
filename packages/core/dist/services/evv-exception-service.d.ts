import type { EvvVisit } from '../domain/evv.js';
import type { EvvException } from '../domain/evv-exception.js';
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
export declare function detectVisitExceptions(visit: EvvVisit, opts?: DetectExceptionOptions): DetectedException[];
//# sourceMappingURL=evv-exception-service.d.ts.map