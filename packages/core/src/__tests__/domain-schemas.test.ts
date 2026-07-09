import { describe, expect, it } from 'vitest';
import {
  agencySchema,
  assignmentInputSchema,
  authorizationSchema,
  caregiverCredentialSchema,
  evvClockInInputSchema,
  evvClockOutInputSchema,
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

  it('accepts optional visit documentation at clock-out and bounds the note', () => {
    const location = { lat: 40.4406, lng: -79.9959, accuracy: 10 };

    // Documentation is optional, a bare clock-out still validates.
    expect(() => evvClockOutInputSchema.parse({ location })).not.toThrow();

    const documented = evvClockOutInputSchema.parse({
      location,
      taskIds: ['134', '115'],
      note: '  Client ate well.  '
    });
    expect(documented.taskIds).toEqual(['134', '115']);
    // Note is trimmed at the schema boundary.
    expect(documented.note).toBe('Client ate well.');

    expect(() =>
      evvClockOutInputSchema.parse({ location, note: 'x'.repeat(2001) })
    ).toThrow();
  });

  it('bounds the e-signature stroke payload', () => {
    const location = { lat: 40.4406, lng: -79.9959, accuracy: 10 };
    const base = { width: 320, height: 160, signerRole: 'client' as const };

    expect(() =>
      evvClockOutInputSchema.parse({
        location,
        signature: { ...base, strokes: [[[1, 2], [3, 4]]], signerName: 'Jane Q. Client' }
      })
    ).not.toThrow();

    // Empty drawing, non-integer points, and >4000 total points all refuse.
    expect(() =>
      evvClockOutInputSchema.parse({ location, signature: { ...base, strokes: [] } })
    ).toThrow();
    expect(() =>
      evvClockOutInputSchema.parse({ location, signature: { ...base, strokes: [[[1.5, 2]]] } })
    ).toThrow();
    const tooMany = Array.from({ length: 5 }, () =>
      Array.from({ length: 900 }, (_, i) => [i % 400, (i * 2) % 400] as [number, number])
    );
    expect(() =>
      evvClockOutInputSchema.parse({ location, signature: { ...base, strokes: tooMany } })
    ).toThrow('4000-point');
  });
});
