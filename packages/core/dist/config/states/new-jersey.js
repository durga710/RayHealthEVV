/**
 * New Jersey state configuration.
 *
 * NJ uses HHAeXchange exclusively (no agency choice). Tighter GPS
 * tolerance than PA — 75m geofence. Training spec under N.J.A.C. 8:42.
 *
 * Marked productionReady=false until the first NJ-licensed agency onboards
 * and we confirm the credential set matches their state inspection checklist.
 */
export const NEW_JERSEY = {
    code: 'NJ',
    name: 'New Jersey',
    defaultAggregator: 'hhaexchange',
    aggregatorChoice: false,
    defaultGeofenceRadiusMeters: 75,
    minGpsAccuracyMeters: 40,
    operatingTracks: [
        { code: 'personal_care', label: 'Personal Care Assistant (PCA)' },
        { code: 'home_health', label: 'Home Health Aide (HHA)' },
        { code: 'respite', label: 'Respite Care' },
    ],
    credentialTypes: [
        { code: 'orientation', label: 'NJ HHA / PCA orientation', requiredForFirstVisit: true, annualRecert: false },
        { code: 'hipaa', label: 'HIPAA Privacy & Security', requiredForFirstVisit: true, annualRecert: true },
        { code: 'cpr_first_aid', label: 'CPR + First Aid', requiredForFirstVisit: true, annualRecert: false },
        { code: 'background_check', label: 'NJ State Police background check', requiredForFirstVisit: true, annualRecert: false },
        { code: 'tb_screening', label: 'TB screening', requiredForFirstVisit: true, annualRecert: true },
    ],
    trainingRegulation: 'N.J.A.C. 8:42',
    productionReady: false,
};
//# sourceMappingURL=new-jersey.js.map