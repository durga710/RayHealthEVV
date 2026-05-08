import { describe, expect, it } from 'vitest';
import { evaluateCredentialEligibility } from '../services/credential-policy-service.js';
describe('credential policy service', () => {
    it('marks a caregiver ineligible when a required credential is expired', async () => {
        const result = evaluateCredentialEligibility({
            operatingTrack: 'home-health',
            credentials: [{ credentialType: 'tb-screening', status: 'expired' }]
        });
        expect(result.eligible).toBe(false);
        expect(result.reasons).toContain('tb-screening');
    });
});
//# sourceMappingURL=credential-policy-service.test.js.map