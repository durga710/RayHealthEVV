/**
 * Pennsylvania state configuration.
 *
 * Aggregator: PA DHS lets each agency choose between Sandata and HHAeXchange.
 * Geofence: 100m default, 50m minimum GPS accuracy.
 * Training: PA Code §52.18 — annual 12-hour continuing education.
 */
export const PENNSYLVANIA = {
    code: 'PA',
    name: 'Pennsylvania',
    defaultAggregator: 'sandata',
    aggregatorChoice: true,
    defaultGeofenceRadiusMeters: 100,
    minGpsAccuracyMeters: 50,
    operatingTracks: [
        { code: 'personal_care', label: 'Personal Care Services (PCS)' },
        { code: 'home_health', label: 'Home Health Care' },
        { code: 'respite', label: 'Respite Care' },
        { code: 'companion', label: 'Companion / Homemaker' },
    ],
    credentialTypes: [
        { code: 'orientation', label: 'New caregiver orientation', requiredForFirstVisit: true, annualRecert: false },
        { code: 'hipaa', label: 'HIPAA Privacy & Security', requiredForFirstVisit: true, annualRecert: true },
        { code: 'abuse_neglect', label: 'Abuse / neglect reporting', requiredForFirstVisit: true, annualRecert: true },
        { code: 'infection_control', label: 'Infection control', requiredForFirstVisit: true, annualRecert: true },
        { code: 'cpr_first_aid', label: 'CPR + First Aid', requiredForFirstVisit: true, annualRecert: false },
        { code: 'tb_screening', label: 'TB screening', requiredForFirstVisit: true, annualRecert: true },
        { code: 'background_check', label: 'PA Criminal History (Act 153)', requiredForFirstVisit: true, annualRecert: false },
    ],
    trainingRegulation: 'PA Code §52.18 (Annual Caregiver Training)',
    productionReady: true,
};
//# sourceMappingURL=pennsylvania.js.map