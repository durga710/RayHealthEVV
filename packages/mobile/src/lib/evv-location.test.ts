import { describe, it, expect } from 'vitest';
import { resolveClockOutLocation } from './evv-location';

describe('resolveClockOutLocation', () => {
  it('prefers the live fix when present', () => {
    const r = resolveClockOutLocation(
      { lat: 40.1, lng: -75.2, accuracy: 8 },
      { lat: 41.0, lng: -76.0, accuracy: 50 },
    );
    expect(r).toEqual({ payload: { lat: 40.1, lng: -75.2, accuracy: 8 }, captured: true });
  });

  it('falls back to last-known when there is no live fix', () => {
    const r = resolveClockOutLocation(null, { lat: 41.0, lng: -76.0, accuracy: 50 });
    expect(r).toEqual({ payload: { lat: 41.0, lng: -76.0, accuracy: 50 }, captured: true });
  });

  it('still allows clock-out with a zeroed payload when no location is available', () => {
    // The safety net: a caregiver is never trapped in an open visit.
    const r = resolveClockOutLocation(null, null);
    expect(r).toEqual({ payload: { lat: 0, lng: 0, accuracy: 0 }, captured: false });
  });

  it('is honest: captured is false only for the zeroed fallback', () => {
    expect(resolveClockOutLocation(null, null).captured).toBe(false);
    expect(resolveClockOutLocation({ lat: 1, lng: 2, accuracy: null }, null).captured).toBe(true);
  });

  it('coerces a null accuracy to 0 in the payload but keeps the fix as captured', () => {
    const r = resolveClockOutLocation({ lat: 1, lng: 2, accuracy: null }, null);
    expect(r.payload.accuracy).toBe(0);
    expect(r.captured).toBe(true);
  });
});
