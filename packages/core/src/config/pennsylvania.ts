export const pennsylvaniaOperatingTracks = ['personal-assistance', 'home-health'] as const;
export const paCredentialTypes = ['tb-screening', 'background-check', 'license', 'training'] as const;
export const paCredentialStatuses = ['active', 'expired', 'pending'] as const;
export const paAssignmentStatuses = ['scheduled', 'completed', 'cancelled'] as const;
export const paExceptionTypes = ['late-clock-in', 'missing-location', 'telephony-fallback', 'manual-entry'] as const;
export const paCaregiverStatuses = ['active', 'inactive', 'suspended'] as const;

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
] as const;
export type CuresActDataPoint = typeof curesActEvvDataPoints[number];

/** Aggregators currently certified by Pennsylvania for EVV submission. */
export const paAggregators = ['hhaexchange', 'sandata'] as const;
export type PaAggregator = typeof paAggregators[number];

/** Pennsylvania PCS / HCPCS service codes RayHealth supports for billing + Cures-Act #1. */
export const paServiceCodes = [
  'T1019', // Personal care services, per 15 minutes
  'S5125', // Attendant care services, per 15 minutes
  'T1004', // Services of a qualified nursing aide, up to 15 minutes
  'T1021'  // Home health aide or certified nurse assistant, per visit
] as const;
export type PaServiceCode = typeof paServiceCodes[number];

export type PaCredentialType = typeof paCredentialTypes[number];
export type PaExceptionType = typeof paExceptionTypes[number];

export type AppRole = 'admin' | 'coordinator' | 'caregiver' | 'family';

export type Capability =
  | 'agency.read' | 'agency.write'
  | 'staff.read' | 'staff.write'
  | 'client.read' | 'client.write'
  | 'schedule.read' | 'schedule.write'
  | 'evv.read' | 'evv.write'
  | 'auth.read' | 'auth.write'
  | 'audit.read' | 'audit.write'
  | 'learning.read' | 'learning.write';

const ROLE_CAPABILITIES: Record<AppRole, Capability[]> = {
  admin: [
    'agency.read', 'agency.write',
    'staff.read', 'staff.write',
    'client.read', 'client.write',
    'schedule.read', 'schedule.write',
    'evv.read', 'evv.write',
    'auth.read', 'auth.write',
    'audit.read', 'audit.write',
    'learning.read', 'learning.write'
  ],
  coordinator: [
    'agency.read',
    'staff.read',
    'client.read', 'client.write',
    'schedule.read', 'schedule.write',
    'evv.read',
    'learning.read', 'learning.write'
  ],
  caregiver: [
    // EVV write lets caregivers record their own visits without granting
    // broad schedule mutation rights such as creating assignments.
    'schedule.read', 'evv.read', 'evv.write',
    'learning.read'
  ],
  family: [
    'client.read',
    'schedule.read'
  ]
};

export function hasCapability(role: AppRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}
