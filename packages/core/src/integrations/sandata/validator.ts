/**
 * Pre-transmission validation for Sandata Alt EVV.
 *
 * Sandata rejects an entire batch on a single malformed record, so we validate
 * BEFORE mapping/posting. Two severities:
 *  - HARD_BLOCK: the record cannot be transmitted; fix the source data first.
 *  - SOFT_WARN:  Sandata will likely accept it but flag an exception (e.g. a
 *                mobile visit with no GPS), surfaced, not blocking.
 *
 * `validate*` returns `ok = true` only when there are zero HARD_BLOCK issues.
 * Pure functions over domain entities; no I/O.
 */

import type { Client } from '../../domain/client.js';
import type { Caregiver } from '../../domain/caregiver.js';
import type { EvvVisit } from '../../domain/evv.js';

export type ValidationSeverity = 'HARD_BLOCK' | 'SOFT_WARN';

export interface ValidationIssue {
  field: string;
  message: string;
  severity: ValidationSeverity;
}

export interface ValidationResult {
  /** True when there are no HARD_BLOCK issues. SOFT_WARN issues may still be present. */
  ok: boolean;
  issues: ValidationIssue[];
}

export interface SandataValidationContext {
  /** When true (GPS program), client coordinates and call GPS are required (HARD_BLOCK). */
  gpsRequired?: boolean;
}

function result(issues: ValidationIssue[]): ValidationResult {
  return { ok: !issues.some((i) => i.severity === 'HARD_BLOCK'), issues };
}

const ZIP_RE = /^\d{5}(\d{4})?$/;

/** Validate a Client for Sandata CLIENT transmission. */
export function validateClient(client: Client, ctx: SandataValidationContext = {}): ValidationResult {
  const issues: ValidationIssue[] = [];
  const block = (field: string, message: string) => issues.push({ field, message, severity: 'HARD_BLOCK' });
  const warn = (field: string, message: string) => issues.push({ field, message, severity: 'SOFT_WARN' });

  if (!client.id) block('ClientCustomID', 'Client has no id to use as the Sandata custom id');
  if (!client.firstName?.trim()) block('ClientFirstName', 'First name is required');
  if (!client.lastName?.trim()) block('ClientLastName', 'Last name is required');
  if (!client.medicaidNumber?.trim()) block('ClientMedicaidID', 'Medicaid ID is required for Sandata');

  if (!client.addressLine1?.trim()) {
    block('ClientAddressLine1', 'A service address is required');
  } else {
    if (!client.state || client.state.length !== 2) block('ClientState', 'State must be the 2-character code');
    if (!client.postalCode || !ZIP_RE.test(client.postalCode.replace(/-/g, ''))) {
      block('ClientZip', 'ZIP must be 5 or 9 digits');
    }
    if (!client.city?.trim()) block('ClientCity', 'City is required');
  }

  const hasGps = client.latitude != null && client.longitude != null;
  if (!hasGps) {
    if (ctx.gpsRequired) block('ClientLatitude', 'Client GPS coordinates are required for this program');
    else warn('ClientLatitude', 'No client GPS anchor; visit geofencing cannot be verified');
  }

  return result(issues);
}

/** Validate a Caregiver for Sandata EMPLOYEE transmission. */
export function validateEmployee(caregiver: Caregiver): ValidationResult {
  const issues: ValidationIssue[] = [];
  const block = (field: string, message: string) => issues.push({ field, message, severity: 'HARD_BLOCK' });

  if (!caregiver.id) block('EmployeeCustomID', 'Caregiver has no id to use as the Sandata custom id');
  if (!caregiver.firstName?.trim()) block('EmployeeFirstName', 'First name is required');
  if (!caregiver.lastName?.trim()) block('EmployeeLastName', 'Last name is required');

  return result(issues);
}

/** Validate an EvvVisit for Sandata VISIT transmission. */
export function validateVisit(visit: EvvVisit, ctx: SandataValidationContext = {}): ValidationResult {
  const issues: ValidationIssue[] = [];
  const block = (field: string, message: string) => issues.push({ field, message, severity: 'HARD_BLOCK' });
  const warn = (field: string, message: string) => issues.push({ field, message, severity: 'SOFT_WARN' });

  if (!visit.id) block('VisitOtherID', 'Visit has no id to use as the Sandata visit id');
  if (!visit.clientId) block('ClientCustomID', 'Visit is not linked to a client');
  if (!visit.caregiverId) block('EmployeeCustomID', 'Visit is not linked to a caregiver');
  if (!visit.serviceCode) block('ProcedureCode', 'Visit has no service (procedure) code');

  if (!visit.clockInTime) {
    block('AdjInDateTime', 'Clock-in time is required');
  }
  if (!visit.clockOutTime) {
    block('AdjOutDateTime', 'Visit is not complete (no clock-out); only completed visits transmit');
  } else if (visit.clockInTime && Date.parse(visit.clockOutTime) <= Date.parse(visit.clockInTime)) {
    block('AdjOutDateTime', 'Clock-out must be after clock-in');
  }

  const inGps = visit.clockInLocation != null;
  const outGps = visit.clockOutLocation != null;
  if (!inGps || !outGps) {
    if (ctx.gpsRequired) block('CallLatitude', 'GPS is required on both clock-in and clock-out for this program');
    else warn('CallLatitude', 'Missing GPS on a call; Sandata will flag a location exception');
  }

  return result(issues);
}
