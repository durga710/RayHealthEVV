import type { CaregiverCredential } from '../domain/caregiver.js';
import { type PaCredentialType } from '../config/pennsylvania.js';
export interface CredentialComplianceResult {
    compliant: boolean;
    expiringSoon: CaregiverCredential[];
    expired: CaregiverCredential[];
    missing: PaCredentialType[];
}
export declare class CredentialComplianceService {
    evaluate(credentials: CaregiverCredential[]): CredentialComplianceResult;
    isEligibleForAssignment(credentials: CaregiverCredential[]): boolean;
}
//# sourceMappingURL=credential-compliance-service.d.ts.map