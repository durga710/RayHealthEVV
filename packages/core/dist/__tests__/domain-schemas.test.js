import { describe, expect, it } from 'vitest';
import { agencySchema, assignmentInputSchema, authorizationSchema, caregiverCredentialSchema } from '../index.js';
describe('Pennsylvania domain schemas', () => {
    it('accepts only Pennsylvania agencies', () => {
        expect(() => agencySchema.parse({ name: 'Keystone Care', state: 'OH', operatingTracks: ['home-health'] })).toThrow('Pennsylvania');
    });
    it('requires credential status before assignment', () => {
        expect(() => assignmentInputSchema.parse({ caregiverId: 'cg-1', visitTemplateId: 'vt-1', credentialStatus: 'expired' })).toThrow('eligible');
    });
    it('requires authorization units and service code', () => {
        expect(() => authorizationSchema.parse({ clientId: 'cl-1', payerId: 'payer-1', unitsAuthorized: 0 })).toThrow();
    });
    it('tracks caregiver credentials with expiration dates', () => {
        expect(caregiverCredentialSchema.parse({
            caregiverId: 'cg-1',
            credentialType: 'tb-screening',
            status: 'active',
            expiresAt: '2026-12-31'
        }).status).toBe('active');
    });
});
//# sourceMappingURL=domain-schemas.test.js.map