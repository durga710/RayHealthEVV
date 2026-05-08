import type { EvvVisit } from '../domain/evv.js';
export type EvvElement = 'service-type' | 'individual' | 'date' | 'location' | 'caregiver' | 'time-range';
export interface EvvComplianceResult {
    valid: boolean;
    missingElements: EvvElement[];
    warnings: string[];
}
export declare class EvvComplianceService {
    validate(visit: EvvVisit): EvvComplianceResult;
    isSubmittable(visit: EvvVisit): boolean;
}
//# sourceMappingURL=evv-compliance-service.d.ts.map