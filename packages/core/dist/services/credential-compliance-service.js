import { paCredentialTypes } from '../config/pennsylvania.js';
const EXPIRY_WARNING_DAYS = 30;
export class CredentialComplianceService {
    evaluate(credentials) {
        const now = new Date();
        const warnThreshold = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 86400000);
        const expired = credentials.filter(c => c.status === 'expired' || new Date(c.expiresAt) < now);
        const expiringSoon = credentials.filter(c => {
            const exp = new Date(c.expiresAt);
            return c.status === 'active' && exp >= now && exp <= warnThreshold;
        });
        const presentTypes = new Set(credentials.map(c => c.credentialType));
        const missing = paCredentialTypes.filter(t => !presentTypes.has(t));
        return {
            compliant: expired.length === 0 && missing.length === 0,
            expiringSoon,
            expired,
            missing,
        };
    }
    isEligibleForAssignment(credentials) {
        return this.evaluate(credentials).compliant;
    }
}
//# sourceMappingURL=credential-compliance-service.js.map