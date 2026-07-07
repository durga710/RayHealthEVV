/**
 * Pure resolution of the location payload sent at CLOCK-OUT. No React Native
 * imports, so it is unit-testable and is the single source of truth for two
 * EVV-critical guarantees the caregiver depends on:
 *
 *  1. A caregiver must ALWAYS be able to end a shift. If neither a live fix nor
 *     a last-known position is available, we still send a payload (zeroed) so
 *     the clock-out request can proceed and the server decides — the caregiver
 *     is never trapped in an open visit by a stale or denied GPS watch.
 *  2. Honesty about what was captured. `captured` is true only when a REAL
 *     coordinate (live or last-known) backed the payload. It drives the
 *     completion badge so the app never claims "GPS verified" for a zeroed fix.
 *
 * The SERVER independently records and evaluates the location; this only shapes
 * what the client sends and what it truthfully tells the caregiver.
 */

export interface FixCoords {
  lat: number;
  lng: number;
  /** Accuracy in metres, or null when the platform didn't report it. */
  accuracy: number | null;
}

export interface ClockOutLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface ResolvedClockOut {
  /** The location body to POST with the clock-out. */
  payload: ClockOutLocation;
  /** True only when a real coordinate (live or last-known) was available. */
  captured: boolean;
}

/**
 * Choose the clock-out location: prefer the live fix, then last-known, then a
 * zeroed fallback (so clock-out is never blocked). `captured` reflects whether a
 * real coordinate backed the payload.
 */
export function resolveClockOutLocation(
  live: FixCoords | null,
  lastKnown: FixCoords | null,
): ResolvedClockOut {
  const chosen = live ?? lastKnown ?? null;
  if (!chosen) {
    return { payload: { lat: 0, lng: 0, accuracy: 0 }, captured: false };
  }
  return {
    payload: { lat: chosen.lat, lng: chosen.lng, accuracy: chosen.accuracy ?? 0 },
    captured: true,
  };
}
