export const pennsylvaniaOperatingTracks = ['personal-assistance', 'home-health'];
export const paCredentialTypes = ['tb-screening', 'background-check', 'license', 'training'];
export const paCredentialStatuses = ['active', 'expired', 'pending'];
export const paAssignmentStatuses = ['scheduled', 'completed', 'cancelled'];
export const paExceptionTypes = ['late-clock-in', 'missing-location', 'telephony-fallback', 'manual-entry'];
export const paCaregiverStatuses = ['active', 'inactive', 'suspended'];
/**
 * The seven data points required by the 21st Century Cures Act for every
 * personal-care and home-health visit (Section 12006). PA aggregators
 * (HHAeXchange, Sandata) all submit these fields.
 *
 * Mapping in RayHealth:
 *   1. service-type   → evv_visits.service_code     (P2-R4a)
 *   2. beneficiary    → evv_visits.client_id        (P2-R4a)
 *   3. date           → evv_visits.clock_in_time (date portion)
 *   4. location       → evv_visits.clock_in_location (lat/lng/accuracy)
 *   5. provider       → evv_visits.caregiver_id
 *   6. start-time     → evv_visits.clock_in_time
 *   7. end-time       → evv_visits.clock_out_time
 */
export const curesActEvvDataPoints = [
    'service-type',
    'beneficiary',
    'date',
    'location',
    'provider',
    'start-time',
    'end-time'
];
/** Aggregators currently certified by Pennsylvania for EVV submission. */
export const paAggregators = ['hhaexchange', 'sandata'];
/** Pennsylvania PCS / HCPCS service codes RayHealth supports for billing + Cures-Act #1. */
export const paServiceCodes = [
    'T1019', // Personal care services, per 15 minutes
    'S5125', // Attendant care services, per 15 minutes
    'T1004', // Services of a qualified nursing aide, up to 15 minutes
    'T1021' // Home health aide or certified nurse assistant, per visit
];
const ROLE_CAPABILITIES = {
    admin: [
        'agency.read', 'agency.write',
        'staff.read', 'staff.write',
        'client.read', 'client.write',
        'schedule.read', 'schedule.write',
        'evv.read', 'evv.write',
        'auth.read', 'auth.write'
    ],
    coordinator: [
        'agency.read',
        'staff.read',
        'client.read', 'client.write',
        'schedule.read', 'schedule.write',
        'evv.read'
    ],
    caregiver: [
        // EVV write lets caregivers record their own visits without granting
        // broad schedule mutation rights such as creating assignments.
        'schedule.read', 'evv.read', 'evv.write'
    ],
    family: [
        'client.read',
        'schedule.read'
    ]
};
export function hasCapability(role, capability) {
    return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}
//# sourceMappingURL=pennsylvania.js.map