import type { EvvVisit } from '../domain/evv.js';

export type EvvElement =
  | 'service-type'
  | 'individual'
  | 'date'
  | 'location'
  | 'caregiver'
  | 'time-range';

export interface EvvComplianceResult {
  valid: boolean;
  missingElements: EvvElement[];
  warnings: string[];
}

export class EvvComplianceService {
  validate(visit: EvvVisit): EvvComplianceResult {
    const missing: EvvElement[] = [];
    const warnings: string[] = [];

    if (!visit.assignmentId) missing.push('service-type');
    if (!visit.caregiverId) missing.push('individual');
    if (!visit.clockInTime) missing.push('date');

    // A location is "missing" only when a coordinate is absent or non-numeric —
    // NOT when it is falsy. Latitude 0 / longitude 0 are valid coordinates (the
    // equator / prime meridian); a falsy test would misclassify a genuine fix
    // there as missing and file a spurious exception.
    const loc = visit.clockInLocation;
    const hasCoord = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
    if (!loc || !hasCoord(loc.lat) || !hasCoord(loc.lng)) {
      missing.push('location');
    } else if (loc.accuracy > 100) {
      warnings.push('Clock-in GPS accuracy exceeds 100m threshold');
    }

    if (!visit.clockInTime || !visit.clockOutTime) missing.push('time-range');

    const unique = [...new Set(missing)];
    return { valid: unique.length === 0, missingElements: unique, warnings };
  }

  isSubmittable(visit: EvvVisit): boolean {
    return this.validate(visit).valid;
  }
}
