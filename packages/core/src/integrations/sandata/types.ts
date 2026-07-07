/**
 * RayHealth EVV → Sandata Alt EVV Integration, type definitions.
 *
 * Ported from the Sandata Open EVV / Alt EVV REST API reference (PA Alt EVV
 * Technical Specification v1.4). Field names below are CASE SENSITIVE and must
 * match Sandata's published specification EXACTLY, do not rename or recase.
 * Confirm required/optional flags and PA-specific code values against the
 * credentialed PA addendum before production.
 */

/** Sandata supports only string | number | boolean on the wire. */
export type SandataScalar = string | number | boolean;

/** The three independent record types carried over one data pipe. */
export enum SandataEntityType {
  CLIENT = 'CLIENT',
  EMPLOYEE = 'EMPLOYEE',
  VISIT = 'VISIT',
}

/** Status of a record as tracked locally in RayHealth. */
export enum SandataRecordStatus {
  PENDING = 'PENDING', // not yet transmitted
  RECEIVED = 'RECEIVED', // POSTed, UUID returned, awaiting /status
  VERIFIED = 'VERIFIED', // accepted by Sandata, no blocking exceptions
  EXCEPTION = 'EXCEPTION', // accepted but has unresolved exceptions
  REJECTED = 'REJECTED', // rejected; must fix + resend w/ incremented sequence
}

/** Capture method for a clock-in / clock-out "call". */
export enum SandataCallType {
  MOBILE = 'Mobile',
  TELEPHONY = 'Telephony',
  FVV = 'FVV', // Fixed Verification Device
  MANUAL = 'Manual',
  OTHER = 'Other',
}

// ── CLIENT entity (CMS element #2, individual receiving service) ────────────

export interface SandataClient {
  /** Sandata-assigned payer ID (from implementation). */
  PayerID?: string;
  PayerProgram?: string;

  /** RayHealth internal client ID, reused as the link key on visits. */
  ClientCustomID: string;

  /** Member / Medicaid identifier. */
  ClientMedicaidID?: string;
  ClientOtherID?: string;
  ClientQualifier?: string;

  ClientFirstName: string;
  ClientMiddleInitial?: string;
  ClientLastName: string;

  ClientTimezone?: string; // e.g. "US/Eastern"
  ClientStatus?: string; // 2-digit status code

  ClientAddress?: SandataClientAddress[];

  /** Per-record sequence number (see state repository). */
  SequenceID: number;
}

export interface SandataClientAddress {
  ClientAddressType?: 'Home' | 'Business' | 'Other';
  ClientAddressLine1: string;
  ClientAddressLine2?: string;
  ClientCity: string;
  ClientState: string; // 2-char
  ClientZip: string; // 5 or 9 digit
  /** REQUIRED if program uses GPS validation. RayHealth must geocode. */
  ClientLatitude?: number;
  ClientLongitude?: number;
}

// ── EMPLOYEE entity (CMS element #5, individual providing service) ──────────

export interface SandataEmployee {
  /** RayHealth internal caregiver ID, reused as the link key on visits. */
  EmployeeCustomID: string;

  /** Identifier or Medicaid ID for the caregiver. */
  EmployeeQualifier?: string;
  EmployeeOtherID?: string;

  EmployeeLastName: string;
  EmployeeFirstName: string;
  EmployeeEmail?: string;
  EmployeeDateOfHire?: string; // CCYYMMDD

  SequenceID: number;
}

// ── VISIT entity (CMS elements #1 service, #3 date, #4 location, #6 time) ─────

export interface SandataVisit {
  /** RayHealth unique visit key (sequence-tracked). */
  VisitOtherID: string;

  /** MUST reference an already-accepted Client. */
  ClientCustomID: string;
  /** MUST reference an already-accepted Employee. */
  EmployeeCustomID: string;

  /** CMS #1, type of service. */
  ProcedureCode: string; // HCPCS, per PA addendum
  Modifier1?: string;
  Modifier2?: string;
  Modifier3?: string;
  Modifier4?: string;

  VisitTimeZone?: string;

  /** CMS #6, adjusted in/out if manual, else actual. UTC. */
  AdjInDateTime?: string; // ISO 8601 UTC
  AdjOutDateTime?: string; // ISO 8601 UTC

  BillVisit?: boolean;
  BilledHours?: number;
  VisitMemo?: string;

  /** Clock in/out events. CMS #4 location lives here. */
  Calls?: SandataCall[];

  /** Care-plan tasks performed (conditional, per PA service-task appendix). */
  Tasks?: SandataTask[];

  /** Acknowledgements for resolvable exceptions. */
  Exceptions?: SandataExceptionAck[];

  /** Conditional, present when visit was manually entered/adjusted. */
  VisitChanges?: SandataVisitChange[];

  SequenceID: number;
}

export interface SandataCall {
  CallExternalID: string;
  /** CMS #6, event timestamp. UTC. */
  CallDateTime: string;
  CallAssignment?: 'Time In' | 'Time Out';
  CallType: SandataCallType;
  /** CMS #4, location. Required for Mobile calls. */
  CallLatitude?: number;
  CallLongitude?: number;
  /** Required if CallType = Telephony. */
  TelephonyPIN?: number;
  OriginatingPhoneNumber?: string;
  GroupVisit?: boolean;
}

export interface SandataTask {
  /** Task ID from the PA service-task appendix. */
  TaskID: string;
  TaskReading?: string;
  TaskRefused?: boolean;
}

export interface SandataExceptionAck {
  ExceptionID: string;
  AcknowledgedBy?: string;
  AcknowledgedDateTime?: string;
}

export interface SandataVisitChange {
  ChangeMadeBy?: string;
  ChangeDateTime?: string;
  /** Reason code per PA addendum. */
  ReasonCode: string;
  ResolutionCode?: string;
  ChangeReasonMemo?: string;
}

// ── API request / response envelopes ─────────────────────────────────────────

/** A batch of 1-5,000 records of a single entity type. */
export type SandataBatch<T> = T[];

/** Immediate response to a POST. NOT a validation result. */
export interface SandataPostResponse {
  uuid: string;
  status: string; // e.g. "RECEIVED"
  message?: string;
}

/** Response from GET /{entity}/status/{uuid}. */
export interface SandataStatusResponse {
  uuid: string;
  /** Overall transmission status. */
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | string;
  /** Per-record outcomes. */
  records?: SandataRecordResult[];
  message?: string; // e.g. "The result for the input UUID is not ready yet."
}

export interface SandataRecordResult {
  /** Echoes the record's custom ID (ClientCustomID / EmployeeCustomID / VisitOtherID). */
  externalID: string;
  status: 'ACCEPTED' | 'REJECTED' | 'EXCEPTION' | string;
  /** Reason / error codes when rejected or flagged. */
  reasonCodes?: string[];
  description?: string;
}

// ── Transport config ─────────────────────────────────────────────────────────

export interface SandataAltEvvConfig {
  baseUrl: string; // UAT or PROD endpoint base
  username: string; // Basic Auth
  password: string; // Basic Auth
  /** Provided by Sandata for multi-agency (MCO/vendor) transmissions. */
  entityGuid?: string;
  /** Max records per POST per Sandata spec. */
  maxBatchSize: number; // 5000
  /** Delay before first status poll (Sandata recommends ~5 min). */
  statusPollDelayMs: number; // 300000
  /** 'UAT' | 'PROD', recorded on each transmission row. */
  environment: 'UAT' | 'PROD';
}
