/**
 * State-strategy types — shared shape for every state's operational config.
 *
 * Each U.S. state has its own EVV aggregator, credentialing rules, geofence
 * tolerance, and operating-track vocabulary. Rather than scattering
 * `if (state === 'PA')` across the codebase, we model every state as a row
 * in a registry. Adding a state is a registry entry, not a refactor.
 */
export type EvvAggregator = 'sandata' | 'hhaexchange' | 'none';
export interface StateOperatingTrack {
    /** Stable identifier used in DB rows. */
    code: string;
    /** Human-readable label for UI. */
    label: string;
}
export interface StateCredentialType {
    code: string;
    label: string;
    /** Required for first client contact per state regulations. */
    requiredForFirstVisit: boolean;
    /** Annual recertification expected? */
    annualRecert: boolean;
}
export interface StateConfig {
    /** Two-letter state code (PA, NY, NJ, ...). */
    code: string;
    /** Full state name for UI. */
    name: string;
    /** Which EVV aggregator the state's Medicaid program uses by default. Some
     * states allow per-agency choice between Sandata and HHAeXchange — we
     * model that with `aggregatorChoice: true` and let agency_evv_config pick. */
    defaultAggregator: EvvAggregator;
    aggregatorChoice: boolean;
    /** Geofence tolerance in meters for an EVV clock-in to count as on-site. */
    defaultGeofenceRadiusMeters: number;
    /** GPS accuracy floor — visits with worse accuracy than this require a
     * coordinator manual review. */
    minGpsAccuracyMeters: number;
    /** Allowed operating tracks for this state's home-care category. */
    operatingTracks: StateOperatingTrack[];
    /** Required credential types for caregivers in this state. */
    credentialTypes: StateCredentialType[];
    /** Citation to the controlling state regulation for orientation/training. */
    trainingRegulation: string;
    /** True when this state's program is supported in production today. */
    productionReady: boolean;
}
//# sourceMappingURL=types.d.ts.map