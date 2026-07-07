/**
 * RayHealth domain → Sandata Alt EVV wire mapping.
 *
 * Pure functions: a domain entity + its per-record SequenceID in, a Sandata
 * wire record out. No I/O, no clock access. Timestamps are emitted as the
 * ISO-8601 UTC strings already stored on the domain rows; date-only fields are
 * rendered CCYYMMDD per the Sandata spec. The mapper does NOT validate, run
 * `validateClient` / `validateEmployee` / `validateVisit` first.
 */

import type { Client } from '../../domain/client.js';
import type { Caregiver } from '../../domain/caregiver.js';
import type { EvvVisit } from '../../domain/evv.js';
import {
  SandataCallType,
  type SandataCall,
  type SandataClient,
  type SandataClientAddress,
  type SandataEmployee,
  type SandataVisit,
} from './types.js';

/** 'YYYY-MM-DD' (or any ISO date) → 'CCYYMMDD'. Returns undefined for empty. */
export function toCCYYMMDD(isoDate: string | undefined | null): string | undefined {
  if (!isoDate) return undefined;
  const datePart = isoDate.slice(0, 10);
  const digits = datePart.replace(/-/g, '');
  return digits.length === 8 ? digits : undefined;
}

/**
 * Map an internal Client to a Sandata CLIENT record.
 *
 * `ClientCustomID` reuses the internal client id and becomes the link key on
 * visits, so it MUST be stable across transmissions.
 */
export function mapClient(client: Client, sequenceId: number): SandataClient {
  const address: SandataClientAddress | undefined = client.addressLine1
    ? {
        ClientAddressType: 'Home',
        ClientAddressLine1: client.addressLine1,
        ...(client.addressLine2 ? { ClientAddressLine2: client.addressLine2 } : {}),
        ClientCity: client.city ?? '',
        ClientState: client.state ?? '',
        ClientZip: client.postalCode ?? '',
        ...(client.latitude != null ? { ClientLatitude: client.latitude } : {}),
        ...(client.longitude != null ? { ClientLongitude: client.longitude } : {}),
      }
    : undefined;

  return {
    ClientCustomID: client.id ?? '',
    ...(client.medicaidNumber ? { ClientMedicaidID: client.medicaidNumber } : {}),
    ClientFirstName: client.firstName,
    ClientLastName: client.lastName,
    ...(address ? { ClientAddress: [address] } : {}),
    SequenceID: sequenceId,
  };
}

/**
 * Map an internal Caregiver to a Sandata EMPLOYEE record.
 *
 * `EmployeeCustomID` reuses the internal caregiver id and becomes the link key
 * on visits.
 */
export function mapEmployee(caregiver: Caregiver, sequenceId: number): SandataEmployee {
  const dateOfHire = toCCYYMMDD(caregiver.hireDate);
  return {
    EmployeeCustomID: caregiver.id ?? '',
    ...(caregiver.npi ? { EmployeeQualifier: caregiver.npi } : {}),
    EmployeeLastName: caregiver.lastName,
    EmployeeFirstName: caregiver.firstName,
    ...(caregiver.email ? { EmployeeEmail: caregiver.email } : {}),
    ...(dateOfHire ? { EmployeeDateOfHire: dateOfHire } : {}),
    SequenceID: sequenceId,
  };
}

export interface MapVisitOptions {
  /** Capture method for the visit's calls. Defaults to Mobile (GPS). */
  callType?: SandataCallType;
  /** Procedure code override; defaults to the visit's stored serviceCode. */
  procedureCode?: string;
  /** Up to four HCPCS modifiers (PA addendum). */
  modifiers?: string[];
}

/**
 * Map an internal EvvVisit to a Sandata VISIT record, deriving Time In / Time
 * Out calls from the visit's clock events. The referenced Client and Employee
 * MUST already be VERIFIED by Sandata (load-order dependency), that gate lives
 * in the transmission service, not here.
 */
export function mapVisit(visit: EvvVisit, sequenceId: number, opts: MapVisitOptions = {}): SandataVisit {
  const callType = opts.callType ?? SandataCallType.MOBILE;
  const calls: SandataCall[] = [];

  calls.push({
    CallExternalID: `${visit.id ?? visit.assignmentId}-in`,
    CallDateTime: visit.clockInTime,
    CallAssignment: 'Time In',
    CallType: callType,
    ...(visit.clockInLocation
      ? { CallLatitude: visit.clockInLocation.lat, CallLongitude: visit.clockInLocation.lng }
      : {}),
  });

  if (visit.clockOutTime) {
    calls.push({
      CallExternalID: `${visit.id ?? visit.assignmentId}-out`,
      CallDateTime: visit.clockOutTime,
      CallAssignment: 'Time Out',
      CallType: callType,
      ...(visit.clockOutLocation
        ? { CallLatitude: visit.clockOutLocation.lat, CallLongitude: visit.clockOutLocation.lng }
        : {}),
    });
  }

  const modifiers = opts.modifiers ?? [];

  return {
    VisitOtherID: visit.id ?? '',
    ClientCustomID: visit.clientId ?? '',
    EmployeeCustomID: visit.caregiverId,
    ProcedureCode: opts.procedureCode ?? visit.serviceCode ?? '',
    ...(modifiers[0] ? { Modifier1: modifiers[0] } : {}),
    ...(modifiers[1] ? { Modifier2: modifiers[1] } : {}),
    ...(modifiers[2] ? { Modifier3: modifiers[2] } : {}),
    ...(modifiers[3] ? { Modifier4: modifiers[3] } : {}),
    AdjInDateTime: visit.clockInTime,
    ...(visit.clockOutTime ? { AdjOutDateTime: visit.clockOutTime } : {}),
    Calls: calls,
    SequenceID: sequenceId,
  };
}
