/**
 * Bulk import / migration service.
 *
 * Onboarding a homecare agency off another platform (HHAeXchange, Sandata,
 * Tellus, a spreadsheet) means importing their clients, caregivers, and
 * authorizations. This module is the PURE half of that pipeline: an RFC-4180
 * CSV parser plus per-entity row validators that turn raw CSV text into typed,
 * normalized rows with per-row error reporting. No database access here, the
 * routes layer takes the validated rows and upserts them (idempotently, keyed
 * on `external_id`) inside a transaction.
 *
 * The design mirrors how enterprise importers work: a PREVIEW pass (validate +
 * report every row's status and errors, no writes) followed by a COMMIT pass
 * (upsert the rows that validated). Same parser + validators feed both.
 */

import { paServiceCodes, type PaServiceCode } from '../config/pennsylvania.js';

export type ImportEntity = 'clients' | 'caregivers' | 'authorizations' | 'visits';

export const IMPORT_ENTITIES: readonly ImportEntity[] = [
  'clients',
  'caregivers',
  'authorizations',
  'visits',
] as const;

// ── Normalized row shapes ───────────────────────────────────────────────────

export interface ImportClientRow {
  externalId: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  medicaidNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusM?: number;
}

export interface ImportCaregiverRow {
  externalId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  npi?: string;
  hireDate?: string; // YYYY-MM-DD
  status: 'active' | 'inactive';
}

export interface ImportAuthorizationRow {
  externalId: string | null;
  clientExternalId: string; // links to a client's external_id
  payerId: string;
  serviceCode: PaServiceCode;
  unitsAuthorized: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface ImportVisitRow {
  /** REQUIRED for visits: the source system's visit id is the idempotent skip
   *  key (evv_visits is immutable, so re-runs skip rather than update). */
  externalId: string;
  clientExternalId: string;
  caregiverExternalId: string;
  serviceCode: PaServiceCode;
  clockInTime: string; // ISO-8601
  clockOutTime?: string; // ISO-8601, after clockInTime
  clockInLatitude?: number;
  clockInLongitude?: number;
  clockOutLatitude?: number;
  clockOutLongitude?: number;
  status: 'pending' | 'verified' | 'flagged';
}

export type ImportRow = ImportClientRow | ImportCaregiverRow | ImportAuthorizationRow | ImportVisitRow;

export interface RowResult<T extends ImportRow = ImportRow> {
  /** 1-based data-row number (the header is row 0 and excluded). */
  rowNumber: number;
  status: 'ok' | 'error';
  value?: T;
  errors: string[];
}

/** Header columns for each entity's downloadable CSV template. */
export const IMPORT_TEMPLATES: Record<ImportEntity, string[]> = {
  clients: [
    'external_id',
    'first_name',
    'last_name',
    'date_of_birth',
    'medicaid_number',
    'address_line_1',
    'address_line_2',
    'city',
    'state',
    'postal_code',
    'latitude',
    'longitude',
    'geofence_radius_m',
  ],
  caregivers: [
    'external_id',
    'first_name',
    'last_name',
    'email',
    'phone',
    'npi',
    'hire_date',
    'status',
  ],
  authorizations: [
    'external_id',
    'client_external_id',
    'payer_id',
    'service_code',
    'units_authorized',
    'start_date',
    'end_date',
  ],
  visits: [
    'external_id',
    'client_external_id',
    'caregiver_external_id',
    'service_code',
    'clock_in_time',
    'clock_out_time',
    'clock_in_latitude',
    'clock_in_longitude',
    'clock_out_latitude',
    'clock_out_longitude',
    'status',
  ],
};

// ── CSV parsing (RFC-4180) ──────────────────────────────────────────────────

/**
 * Parse RFC-4180 CSV text into a header + array of records keyed by normalized
 * header name (lowercased, spaces/dashes → underscore). Handles quoted fields
 * with embedded commas, escaped quotes (""), and CRLF or LF line endings.
 * Blank lines are skipped. Throws on a structurally broken file (e.g. an
 * unterminated quote).
 */
export function parseCsv(text: string): {
  header: string[];
  records: Array<Record<string, string>>;
} {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    return { header: [], records: [] };
  }
  const header = rows[0].map(normalizeHeader);
  const records: Array<Record<string, string>> = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    // Skip fully-blank rows (a single empty cell from a trailing newline).
    if (cells.length === 1 && cells[0].trim() === '') continue;
    const rec: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      rec[header[c]] = (cells[c] ?? '').trim();
    }
    records.push(rec);
  }
  return { header, records };
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      // swallow; a following \n handles the row break
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (inQuotes) {
    throw new Error('Malformed CSV: unterminated quoted field');
  }
  // flush last field/row if the file didn't end with a newline
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ── Field helpers ───────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NPI_RE = /^\d{10}$/;
const STATE_RE = /^[A-Za-z]{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidDate(v: string): boolean {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function optNum(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function blankToUndef(v: string | undefined): string | undefined {
  const s = (v ?? '').trim();
  return s === '' ? undefined : s;
}

// ── Per-entity validators ───────────────────────────────────────────────────

function validateClientRow(rec: Record<string, string>): {
  value?: ImportClientRow;
  errors: string[];
} {
  const errors: string[] = [];
  const firstName = (rec.first_name ?? '').trim();
  const lastName = (rec.last_name ?? '').trim();
  const dob = (rec.date_of_birth ?? '').trim();
  if (!firstName) errors.push('first_name is required');
  if (!lastName) errors.push('last_name is required');
  if (!dob) errors.push('date_of_birth is required');
  else if (!isValidDate(dob)) errors.push('date_of_birth must be YYYY-MM-DD');

  const medicaid = blankToUndef(rec.medicaid_number);
  if (medicaid !== undefined && medicaid.length < 10) {
    errors.push('medicaid_number must be at least 10 characters');
  }

  const state = blankToUndef(rec.state);
  if (state !== undefined && !STATE_RE.test(state)) {
    errors.push('state must be a 2-letter code');
  }

  const lat = optNum(rec.latitude);
  if (Number.isNaN(lat)) errors.push('latitude must be a number');
  else if (lat !== undefined && (lat < -90 || lat > 90)) errors.push('latitude out of range');
  const lng = optNum(rec.longitude);
  if (Number.isNaN(lng)) errors.push('longitude must be a number');
  else if (lng !== undefined && (lng < -180 || lng > 180)) errors.push('longitude out of range');
  const geo = optNum(rec.geofence_radius_m);
  if (Number.isNaN(geo)) errors.push('geofence_radius_m must be a number');
  else if (geo !== undefined && geo <= 0) errors.push('geofence_radius_m must be positive');

  if (errors.length > 0) return { errors };
  return {
    errors: [],
    value: {
      externalId: blankToUndef(rec.external_id) ?? null,
      firstName,
      lastName,
      dateOfBirth: dob,
      medicaidNumber: medicaid,
      addressLine1: blankToUndef(rec.address_line_1),
      addressLine2: blankToUndef(rec.address_line_2),
      city: blankToUndef(rec.city),
      state: state ? state.toUpperCase() : undefined,
      postalCode: blankToUndef(rec.postal_code),
      latitude: lat,
      longitude: lng,
      geofenceRadiusM: geo,
    },
  };
}

function validateCaregiverRow(rec: Record<string, string>): {
  value?: ImportCaregiverRow;
  errors: string[];
} {
  const errors: string[] = [];
  const firstName = (rec.first_name ?? '').trim();
  const lastName = (rec.last_name ?? '').trim();
  const email = (rec.email ?? '').trim().toLowerCase();
  if (!firstName) errors.push('first_name is required');
  if (!lastName) errors.push('last_name is required');
  if (!email) errors.push('email is required');
  else if (!EMAIL_RE.test(email)) errors.push('email is invalid');

  const npi = blankToUndef(rec.npi);
  if (npi !== undefined && !NPI_RE.test(npi)) errors.push('npi must be exactly 10 digits');

  const hireDate = blankToUndef(rec.hire_date);
  if (hireDate !== undefined && !isValidDate(hireDate)) errors.push('hire_date must be YYYY-MM-DD');

  // The DB CHECK allows active/inactive/terminated; the domain enum uses
  // active/inactive/suspended. Restrict import to the safe intersection so a
  // bad status can never be rejected by the DB at commit time.
  const rawStatus = blankToUndef(rec.status)?.toLowerCase();
  let status: 'active' | 'inactive' = 'active';
  if (rawStatus !== undefined) {
    if (rawStatus === 'active' || rawStatus === 'inactive') status = rawStatus;
    else errors.push("status must be 'active' or 'inactive'");
  }

  if (errors.length > 0) return { errors };
  return {
    errors: [],
    value: {
      externalId: blankToUndef(rec.external_id) ?? null,
      firstName,
      lastName,
      email,
      phone: blankToUndef(rec.phone),
      npi,
      hireDate,
      status,
    },
  };
}

function validateAuthorizationRow(rec: Record<string, string>): {
  value?: ImportAuthorizationRow;
  errors: string[];
} {
  const errors: string[] = [];
  const clientExternalId = (rec.client_external_id ?? '').trim();
  const payerId = (rec.payer_id ?? '').trim();
  const serviceCode = (rec.service_code ?? '').trim().toUpperCase();
  const start = (rec.start_date ?? '').trim();
  const end = (rec.end_date ?? '').trim();

  if (!clientExternalId) errors.push('client_external_id is required (links to a client external_id)');
  if (!payerId) errors.push('payer_id is required');
  if (!serviceCode) errors.push('service_code is required');
  else if (!(paServiceCodes as readonly string[]).includes(serviceCode)) {
    errors.push(`service_code must be one of: ${paServiceCodes.join(', ')}`);
  }
  const units = optNum(rec.units_authorized);
  if (units === undefined) errors.push('units_authorized is required');
  else if (Number.isNaN(units) || units <= 0) errors.push('units_authorized must be a positive number');
  if (!start) errors.push('start_date is required');
  else if (!isValidDate(start)) errors.push('start_date must be YYYY-MM-DD');
  if (!end) errors.push('end_date is required');
  else if (!isValidDate(end)) errors.push('end_date must be YYYY-MM-DD');
  if (start && end && isValidDate(start) && isValidDate(end) && end < start) {
    errors.push('end_date must be on or after start_date');
  }

  if (errors.length > 0) return { errors };
  return {
    errors: [],
    value: {
      externalId: blankToUndef(rec.external_id) ?? null,
      clientExternalId,
      payerId,
      serviceCode: serviceCode as PaServiceCode,
      unitsAuthorized: units as number,
      startDate: start,
      endDate: end,
    },
  };
}

function isValidIsoInstant(v: string): boolean {
  // Require a full ISO-8601 instant WITH an explicit timezone (Z or ±HH:MM).
  // A bare date has no time of day, and a naive datetime would be parsed as
  // the server's local time , the same CSV row would store a different
  // clock_in_time depending on the process TZ, which is unacceptable for
  // compliance timestamps. Prior-system exports must state their offset.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(v)) return false;
  return !Number.isNaN(Date.parse(v));
}

function validateVisitRow(rec: Record<string, string>): {
  value?: ImportVisitRow;
  errors: string[];
} {
  const errors: string[] = [];
  const externalId = (rec.external_id ?? '').trim();
  const clientExternalId = (rec.client_external_id ?? '').trim();
  const caregiverExternalId = (rec.caregiver_external_id ?? '').trim();
  const serviceCode = (rec.service_code ?? '').trim().toUpperCase();
  const clockIn = (rec.clock_in_time ?? '').trim();
  const clockOut = blankToUndef(rec.clock_out_time);

  // Unlike the other entities, external_id is REQUIRED here: visits are
  // immutable, so the dedupe key is the only thing that makes re-uploading a
  // corrected file safe (existing rows skip instead of duplicating).
  if (!externalId) errors.push('external_id is required (the source system visit id)');
  if (!clientExternalId) errors.push('client_external_id is required (links to a client external_id)');
  if (!caregiverExternalId) errors.push('caregiver_external_id is required (links to a caregiver external_id)');
  if (!serviceCode) errors.push('service_code is required');
  else if (!(paServiceCodes as readonly string[]).includes(serviceCode)) {
    errors.push(`service_code must be one of: ${paServiceCodes.join(', ')}`);
  }
  if (!clockIn) errors.push('clock_in_time is required');
  else if (!isValidIsoInstant(clockIn)) {
    errors.push('clock_in_time must be an ISO-8601 datetime with timezone (e.g. 2024-03-01T09:00:00Z or 2024-03-01T09:00:00-05:00)');
  }
  if (clockOut !== undefined && !isValidIsoInstant(clockOut)) {
    errors.push('clock_out_time must be an ISO-8601 datetime with timezone');
  }
  if (
    clockOut !== undefined &&
    isValidIsoInstant(clockIn) &&
    isValidIsoInstant(clockOut) &&
    Date.parse(clockOut) <= Date.parse(clockIn)
  ) {
    errors.push('clock_out_time must be after clock_in_time');
  }

  const inLat = optNum(rec.clock_in_latitude);
  const inLng = optNum(rec.clock_in_longitude);
  const outLat = optNum(rec.clock_out_latitude);
  const outLng = optNum(rec.clock_out_longitude);
  for (const [name, v, lo, hi] of [
    ['clock_in_latitude', inLat, -90, 90],
    ['clock_in_longitude', inLng, -180, 180],
    ['clock_out_latitude', outLat, -90, 90],
    ['clock_out_longitude', outLng, -180, 180],
  ] as const) {
    if (Number.isNaN(v)) errors.push(`${name} must be a number`);
    else if (v !== undefined && (v < lo || v > hi)) errors.push(`${name} out of range`);
  }
  if ((inLat === undefined) !== (inLng === undefined)) {
    errors.push('clock_in_latitude and clock_in_longitude must be provided together');
  }
  if ((outLat === undefined) !== (outLng === undefined)) {
    errors.push('clock_out_latitude and clock_out_longitude must be provided together');
  }

  // Default 'verified': imported history was already adjudicated by the prior
  // system; our exception/fraud pipelines only run on visits we captured.
  const rawStatus = blankToUndef(rec.status)?.toLowerCase();
  let status: ImportVisitRow['status'] = 'verified';
  if (rawStatus !== undefined) {
    if (rawStatus === 'pending' || rawStatus === 'verified' || rawStatus === 'flagged') status = rawStatus;
    else errors.push("status must be 'pending', 'verified', or 'flagged'");
  }

  if (errors.length > 0) return { errors };
  return {
    errors: [],
    value: {
      externalId,
      clientExternalId,
      caregiverExternalId,
      serviceCode: serviceCode as PaServiceCode,
      clockInTime: new Date(clockIn).toISOString(),
      clockOutTime: clockOut ? new Date(clockOut).toISOString() : undefined,
      clockInLatitude: inLat,
      clockInLongitude: inLng,
      clockOutLatitude: outLat,
      clockOutLongitude: outLng,
      status,
    },
  };
}

const VALIDATORS: Record<
  ImportEntity,
  (rec: Record<string, string>) => { value?: ImportRow; errors: string[] }
> = {
  clients: validateClientRow,
  caregivers: validateCaregiverRow,
  authorizations: validateAuthorizationRow,
  visits: validateVisitRow,
};

/**
 * Validate every parsed record for an entity. Returns one RowResult per data
 * row, in file order, with a 1-based rowNumber. Pure, no DB. Relational
 * existence checks (e.g. does client_external_id resolve?) happen at commit.
 */
export function validateImportRecords(
  entity: ImportEntity,
  records: Array<Record<string, string>>,
): RowResult[] {
  const validate = VALIDATORS[entity];
  return records.map((rec, idx) => {
    const { value, errors } = validate(rec);
    return errors.length > 0
      ? { rowNumber: idx + 1, status: 'error' as const, errors }
      : { rowNumber: idx + 1, status: 'ok' as const, value, errors: [] };
  });
}

/** Convenience: parse CSV text and validate in one call. */
export function parseAndValidate(entity: ImportEntity, csv: string): {
  header: string[];
  results: RowResult[];
} {
  const { header, records } = parseCsv(csv);
  return { header, results: validateImportRecords(entity, records) };
}
