import type { CaregiverCredential } from '../domain/caregiver.js';
import { paCredentialTypes, type PaCredentialType } from '../config/pennsylvania.js';

export interface CredentialComplianceResult {
  compliant: boolean;
  expiringSoon: CaregiverCredential[];
  expired: CaregiverCredential[];
  missing: PaCredentialType[];
}

const EXPIRY_WARNING_DAYS = 30;

export class CredentialComplianceService {
  evaluate(credentials: CaregiverCredential[]): CredentialComplianceResult {
    const now = new Date();
    const warnThreshold = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 86_400_000);

    const expired = credentials.filter(c => c.status === 'expired' || new Date(c.expiresAt) < now);
    const expiringSoon = credentials.filter(c => {
      const exp = new Date(c.expiresAt);
      return c.status === 'active' && exp >= now && exp <= warnThreshold;
    });

    const presentTypes = new Set(credentials.map(c => c.credentialType));
    const missing = paCredentialTypes.filter(t => !presentTypes.has(t)) as PaCredentialType[];

    return {
      compliant: expired.length === 0 && missing.length === 0,
      expiringSoon,
      expired,
      missing,
    };
  }

  isEligibleForAssignment(credentials: CaregiverCredential[]): boolean {
    return this.evaluate(credentials).compliant;
  }
}
