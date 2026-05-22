export declare const pennsylvaniaOperatingTracks: readonly ["personal-assistance", "home-health"];
export declare const paCredentialTypes: readonly ["tb-screening", "background-check", "license", "training"];
export declare const paCredentialStatuses: readonly ["active", "expired", "pending"];
export declare const paAssignmentStatuses: readonly ["scheduled", "completed", "cancelled"];
export declare const paExceptionTypes: readonly ["late-clock-in", "missing-location", "telephony-fallback", "manual-entry"];
export declare const paCaregiverStatuses: readonly ["active", "inactive", "suspended"];
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
export declare const curesActEvvDataPoints: readonly ["service-type", "beneficiary", "date", "location", "provider", "start-time", "end-time"];
export type CuresActDataPoint = typeof curesActEvvDataPoints[number];
/** Aggregators currently certified by Pennsylvania for EVV submission. */
export declare const paAggregators: readonly ["hhaexchange", "sandata"];
export type PaAggregator = typeof paAggregators[number];
/** Pennsylvania PCS / HCPCS service codes RayHealth supports for billing + Cures-Act #1. */
export declare const paServiceCodes: readonly ["T1019", "S5125", "T1004", "T1021"];
export type PaServiceCode = typeof paServiceCodes[number];
export type PaCredentialType = typeof paCredentialTypes[number];
export type PaExceptionType = typeof paExceptionTypes[number];
export type AppRole = 'admin' | 'coordinator' | 'caregiver' | 'family';
export type Capability = 'agency.read' | 'agency.write' | 'staff.read' | 'staff.write' | 'client.read' | 'client.write' | 'schedule.read' | 'schedule.write' | 'evv.read' | 'evv.write' | 'auth.read' | 'auth.write' | 'audit.read' | 'audit.write' | 'learning.read' | 'learning.write';
export declare function hasCapability(role: AppRole, capability: Capability): boolean;
//# sourceMappingURL=pennsylvania.d.ts.map