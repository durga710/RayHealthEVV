import { describe, expect, it } from 'vitest';
import { agencySchema, assignmentInputSchema, authorizationSchema, caregiverCredentialSchema, evvClockInInputSchema, hasCapability } from '../index.js';
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
    it('separates caregiver EVV write access from schedule mutation', () => {
        expect(hasCapability('caregiver', 'schedule.write')).toBe(false);
        expect(hasCapability('caregiver', 'evv.write')).toBe(true);
    });
    it('validates clock-in GPS coordinates and PA service codes', () => {
        expect(() => evvClockInInputSchema.parse({
            assignmentId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
            serviceCode: 'T1019',
            location: { lat: 40.4406, lng: -79.9959, accuracy: 10 }
        })).not.toThrow();
        expect(() => evvClockInInputSchema.parse({
            assignmentId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
            serviceCode: 'BAD',
            location: { lat: 140, lng: -79.9959, accuracy: -1 }
        })).toThrow();
    });
});
//# sourceMappingURL=domain-schemas.test.js.map