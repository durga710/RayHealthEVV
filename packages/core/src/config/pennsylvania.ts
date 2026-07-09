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

/**
 * Billable units-of-measure per PA service code, used by claim generation to
 * convert a GPS-verified visit duration into Medicaid billing units.
 *
 *   - 15-minute codes (T1019/S5125/T1004): one unit = 15 minutes of service.
 *   - T1021 is billed per-visit (encoded as 0 → one unit per completed visit,
 *     independent of duration).
 *
 * These are HCPCS units of measure, not dollar rates. RayHealth is the
 * verification + claim-assembly layer; the payer's fee schedule determines the
 * paid amount per unit, so we deliberately do NOT hardcode dollar rates here.
 */
export const paServiceCodeUnitMinutes: Record<PaServiceCode, number> = {
  T1019: 15,
  S5125: 15,
  T1004: 15,
  T1021: 0,
};

/** Human-readable HCPCS descriptions for each supported PA service code. */
export const paServiceCodeDescriptions: Record<PaServiceCode, string> = {
  T1019: 'Personal care services, per 15 minutes',
  S5125: 'Attendant care services, per 15 minutes',
  T1004: 'Services of a qualified nursing aide, per 15 minutes',
  T1021: 'Home health aide or certified nurse assistant, per visit',
};

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
  | 'learning.read' | 'learning.write'
  | 'billing.read' | 'billing.write';

const ROLE_CAPABILITIES: Record<AppRole, Capability[]> = {
  admin: [
    'agency.read', 'agency.write',
    'staff.read', 'staff.write',
    'client.read', 'client.write',
    'schedule.read', 'schedule.write',
    'evv.read', 'evv.write',
    'auth.read', 'auth.write',
    'audit.read', 'audit.write',
    'learning.read', 'learning.write',
    'billing.read', 'billing.write'
  ],
  coordinator: [
    'agency.read',
    'staff.read',
    'client.read', 'client.write',
    'schedule.read', 'schedule.write',
    'evv.read',
    'learning.read', 'learning.write',
    // Coordinators can review claim/payroll readiness but not generate or
    // change claim status, those stay admin-only (billing.write).
    'billing.read'
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

// ---------------------------------------------------------------------------
// Pennsylvania regulatory constants, code-truth values used by the
// Compliance Engine. Every value below is sourced from the canonical
// `docs/compliance/states/pennsylvania.md` reference and Pennsylvania
// regulation citations (55 Pa. Code, 23 Pa.C.S., 42 CFR 441). Treat these as
// the single source of truth: any threshold change requires a PR that updates
// both the constant and the doc together.
// ---------------------------------------------------------------------------

/** Pennsylvania PCS geofence base radius (meters). 55 Pa. Code §52.32. */
export const PA_GEOFENCE_BASE_METERS = 100;
/** GPS-accuracy tolerance layered on top of the base radius. */
export const PA_GEOFENCE_TOLERANCE_METERS = 50;
/** Total effective geofence radius used by the EVV mobile check. */
export const PA_GEOFENCE_TOTAL_METERS = PA_GEOFENCE_BASE_METERS + PA_GEOFENCE_TOLERANCE_METERS;
/** FLSA-style "de minimis" grace window after the scheduled start (minutes). */
export const PA_GRACE_PERIOD_MINUTES = 15;
/** Clock-in opens this many minutes before the scheduled start (product policy). */
export const PA_EARLY_CLOCK_IN_GRACE_MINUTES = 5;
/**
 * Assumed visit-window length (hours) when an assignment has a real scheduled
 * start but no scheduled end; clock-in closes this long after the start
 * (product policy, not a regulation).
 */
export const DEFAULT_VISIT_WINDOW_HOURS = 4;
/** VMUR (Visit Maintenance) correction window before the visit is locked (days). */
export const PA_VMUR_CORRECTION_WINDOW_DAYS = 7;
/** PA retains EVV + audit records for 7 years, longest in the nation. */
export const PA_RETENTION_YEARS = 7;
/** PA DHS audit-response SLA from notification to packet submission (hours). */
export const PA_DHS_AUDIT_RESPONSE_HOURS = 48;
/** Plan-of-care review cadence for active CHC clients (days). */
export const PA_POC_REVIEW_DAYS = 60;
/** RN supervisory-visit cadence for a brand-new client (days). */
export const PA_RN_SUPERVISION_NEW_CLIENT_DAYS = 14;
/** RN supervisory-visit cadence for an established client (days). */
export const PA_RN_SUPERVISION_ESTABLISHED_DAYS = 60;
/** Community HealthChoices quarterly review cycle (days). 55 Pa. Code Ch. 6000. */
export const PA_RN_SUPERVISION_CHC_DAYS = 90;
/** PA PATCH + FBI background-check renewal cadence (years). 23 Pa.C.S. §6344. */
export const PA_BACKGROUND_CHECK_RENEWAL_YEARS = 5;
/** Re-run background checks after this many days out of service. */
export const PA_BREAK_IN_SERVICE_RECHECK_DAYS = 365;
/** CNA continuing-education hours per 24-month registry cycle. */
export const PA_CNA_CE_HOURS_PER_CYCLE = 24;
/** CNAs must work at least this many paid months within the registry cycle. */
export const PA_CNA_PAID_WORK_MONTHS = 24;
/** Minimum HHA classroom hours required by 42 CFR 484.80. */
export const PA_HHA_TRAINING_HOURS = 75;
/** Minimum HHA in-service hours per calendar year. */
export const PA_HHA_INSERVICE_HOURS_PER_YEAR = 12;
/** ChildLine + Abuse Registry hotline (PA DHS, 24-hr). */
export const PA_DHS_ABUSE_HOTLINE = '1-800-932-0582';
/** Sandata aggregator EVV submission endpoint (production). */
export const PA_SANDATA_EVV_ENDPOINT = 'https://evv.sandata.com/Sandata.WebServices/Production';
/** Sandata submission window, visits must be submitted within (days). */
export const PA_SANDATA_SUBMISSION_WINDOW_DAYS = 7;

/**
 * The three Community HealthChoices managed-care organisations operating in
 * Pennsylvania. The Compliance Engine surfaces these as policy context for the
 * Medicaid Workflow module until per-MCO tagging lives on the authorizations
 * table.
 */
export const paChcMcos = [
  'AmeriHealth Caritas Northeast',
  'Pennsylvania Health & Wellness',
  'UPMC Community HealthChoices'
] as const;
export type PaChcMco = typeof paChcMcos[number];

/**
 * The six caregiver credential codes PA expects for a fully compliant home-
 * health roster. Used by the Credentials & Background module's policy block
 * so the UI renders the taxonomy without hardcoding it. Distinct from
 * `paCredentialTypes` above, that older list is the persisted-row credential
 * categories; this list is the PA-specific taxonomy.
 */
export const paComplianceCredentials = [
  'pa-patch',         // PA State Police (PATCH)
  'fbi-fingerprint',  // FBI Identity History Summary
  'child-abuse',      // PA Child Abuse History (ChildLine)
  'cna-registry',     // PA Nurse Aide Registry
  'hha-training',     // HHA classroom + competency
  'rn-supervision'    // Active RN supervisor record
] as const;
export type PaComplianceCredential = typeof paComplianceCredentials[number];
