/**
 * Geofence math + policy helper for EVV clock-in / clock-out.
 *
 * The Pennsylvania DHS EVV rule (and most aggregators) requires that the
 * caregiver be physically present at the client's address when the visit
 * starts and ends. We enforce that by comparing the GPS lat/lng captured
 * by the mobile app against the client's registered address coordinates,
 * within a per-client `geofence_radius_m` (defaulting to 150 m at the
 * column level — this module treats `null` radius as "use 150").
 *
 * Distance is computed via the Haversine formula on a spherical Earth,
 * which is accurate to ~0.5% over the distances we care about. Anything
 * tighter (Vincenty etc.) is overkill at a 150 m gate.
 */
/** Haversine distance in meters between two lat/lng points. */
export declare function haversineMeters(a: {
    lat: number;
    lng: number;
}, b: {
    lat: number;
    lng: number;
}): number;
/**
 * Returns null when the clock-in location is within the client's geofence
 * radius (or fail-open: the client has no registered coordinates).
 * Returns an error envelope `{ distanceM, allowedM }` when the caregiver
 * is outside the radius.
 *
 * Fail-open rationale: agencies onboarding new clients will not have GPS
 * coordinates registered yet; rejecting clock-in for them would block the
 * pilot demo and any field rollout where address geocoding is back-filled
 * out-of-band. As soon as an agency sets `latitude` + `longitude` on a
 * client row, the geofence engages. Out-of-bounds attempts are still
 * audited (`permission.denied` with reason: 'geofence') so the policy
 * gap is observable.
 *
 * Note: GPS `accuracy` (meters of reported uncertainty) is intentionally
 * NOT subtracted from the distance here — accuracy values reported by
 * mobile OSes are noisy and would let a caregiver "borrow" 50 m by
 * spoofing low confidence. We treat the reported point as authoritative.
 */
export declare function checkGeofence(clockLocation: {
    lat: number;
    lng: number;
    accuracy: number;
}, client: {
    latitude: number | null;
    longitude: number | null;
    geofenceRadiusM: number | null;
}): null | {
    distanceM: number;
    allowedM: number;
};
//# sourceMappingURL=geofence.d.ts.map