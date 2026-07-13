import { describe, expect, it } from 'vitest';
import {
  agencySchema,
  assignmentInputSchema,
  authorizationSchema,
  caregiverCredentialSchema,
  evvClockInInputSchema,
  hasCapability,
  visitTaskCompletionBatchSchema,
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

  it('rejects non-canonical service codes on authorizations', () => {
    // W-series program codes never appear on an EVV visit or 837 claim line,
    // so an authorization in one would never burn down. The schema blocks them.
    expect(() =>
      authorizationSchema.parse({
        clientId: 'cl-1',
        payerId: 'payer-1',
        unitsAuthorized: 100,
        serviceCode: 'W1793',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
      })
    ).toThrow();

    expect(
      authorizationSchema.parse({
        clientId: 'cl-1',
        payerId: 'payer-1',
        unitsAuthorized: 100,
        serviceCode: 'T1019',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
      }).serviceCode
    ).toBe('T1019');
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

  it('separates caregiver EVV write access from schedule mutation', () => {
    expect(hasCapability('caregiver', 'schedule.write')).toBe(false);
    expect(hasCapability('caregiver', 'evv.write')).toBe(true);
  });

  it('validates clock-in GPS coordinates and PA service codes', () => {
    expect(() =>
      evvClockInInputSchema.parse({
        assignmentId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        serviceCode: 'T1019',
        location: { lat: 40.4406, lng: -79.9959, accuracy: 10 }
      })
    ).not.toThrow();

    expect(() =>
      evvClockInInputSchema.parse({
        assignmentId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        serviceCode: 'BAD',
        location: { lat: 140, lng: -79.9959, accuracy: -1 }
      })
    ).toThrow();
  });

  it('validates idempotent visit task completion batches', () => {
    expect(
      visitTaskCompletionBatchSchema.parse({
        completions: [
          {
            clientEventId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
            taskCode: '122',
            taskLabel: 'Hygiene',
            status: 'performed',
          },
          {
            clientEventId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
            taskCode: '134',
            taskLabel: 'Bathing',
            status: 'refused',
          },
        ],
      }).completions,
    ).toHaveLength(2);

    expect(() =>
      visitTaskCompletionBatchSchema.parse({
        completions: [
          {
            clientEventId: 'not-a-uuid',
            taskCode: 'BAD',
            taskLabel: '',
            status: 'done',
          },
        ],
      }),
    ).toThrow();
  });
});
