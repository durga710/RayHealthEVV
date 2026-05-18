import { describe, expect, it } from 'vitest';
import {
  agencySchema,
  assignmentInputSchema,
  authorizationSchema,
  caregiverCredentialSchema,
  evvClockInInputSchema,
  hasCapability
} from '../index.js';

describe('Pennsylvania domain schemas', () => {
  it('accepts only Pennsylvania agencies', () => {
    expect(() =>
      agencySchema.parse({ name: 'Keystone Care', state: 'OH', operatingTracks: ['home-health'] })
    ).toThrow('Pennsylvania');
  });

  it('requires credential status before assignment', () => {
    expect(() =>
      assignmentInputSchema.parse({ caregiverId: 'cg-1', visitTemplateId: 'vt-1', credentialStatus: 'expired' })
    ).toThrow('eligible');
  });

  it('requires authorization units and service code', () => {
    expect(() =>
      authorizationSchema.parse({ clientId: 'cl-1', payerId: 'payer-1', unitsAuthorized: 0 })
    ).toThrow();
  });

  it('tracks caregiver credentials with expiration dates', () => {
    expect(
      caregiverCredentialSchema.parse({
        caregiverId: 'cg-1',
        credentialType: 'tb-screening',
        status: 'active',
        expiresAt: '2026-12-31'
      }).status
    ).toBe('active');
  });

  it('rejects placeholder assignment IDs for EVV clock-in', () => {
    expect(() =>
      evvClockInInputSchema.parse({
        assignmentId: 'mock-assignment-id',
        location: { lat: 40.2732, lng: -76.8867, accuracy: 18 }
      })
    ).toThrow();
  });

  it('accepts a real assignment and bounded GPS coordinates for EVV clock-in', () => {
    expect(
      evvClockInInputSchema.parse({
        assignmentId: '22222222-2222-4222-8222-222222222222',
        location: { lat: 40.2732, lng: -76.8867, accuracy: 18 }
      }).assignmentId
    ).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('lets caregivers write EVV events without broad schedule write access', () => {
    expect(hasCapability('caregiver', 'evv.write')).toBe(true);
    expect(hasCapability('caregiver', 'schedule.write')).toBe(false);
  });
});
