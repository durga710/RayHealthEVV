/**
 * Pure geofence math for the EVV clock-in/out screen. No React Native imports,
 * so it is unit-testable and is the single source of truth for the distance the
 * UI shows and the inside/outside decision it makes. The SERVER independently
 * re-checks the geofence at clock-in/out, this is the client-side preview only.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in metres between two coordinates (haversine). */
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export type GeoEvaluation =
  | { kind: 'no-geolock' }
  | { kind: 'inside'; distanceM: number }
  | { kind: 'outside'; distanceM: number };

/**
 * Decide whether the current position is within the client's allowed radius.
 * When the client has no configured coordinates the visit is not geolocked, so
 * presence cannot be evaluated (the server still records the raw location).
 */
export function evaluateGeofence(
  current: LatLng,
  clientCoords: LatLng | null,
  allowedRadiusM: number,
): GeoEvaluation {
  if (!clientCoords) return { kind: 'no-geolock' };
  const distanceM = haversineM(current, clientCoords);
  return distanceM <= allowedRadiusM
    ? { kind: 'inside', distanceM }
    : { kind: 'outside', distanceM };
}

/** Human-readable distance (metres under 1 km, else kilometres). */
export function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}
