import { describe, expect, it } from 'vitest';
import {
  parseCsv,
  validateImportRecords,
  parseAndValidate,
  type ImportClientRow,
  type ImportCaregiverRow,
  type ImportAuthorizationRow,
  type ImportVisitRow,
} from '../services/import-service.js';

describe('parseCsv', () => {
  it('parses a header + rows, normalizing header names', () => {
    const { header, records } = parseCsv('First Name,Last-Name\nAda,Lovelace\n');
    expect(header).toEqual(['first_name', 'last_name']);
    expect(records).toEqual([{ first_name: 'Ada', last_name: 'Lovelace' }]);
  });

  it('handles quoted fields with embedded commas, quotes, and newlines', () => {
    const csv = 'a,b\n"hello, world","she said ""hi""\nthen left"\n';
    const { records } = parseCsv(csv);
    expect(records[0].a).toBe('hello, world');
    expect(records[0].b).toBe('she said "hi"\nthen left');
  });

  it('skips blank lines and tolerates a missing trailing newline', () => {
    const { records } = parseCsv('a\n1\n\n2');
    expect(records.map((r) => r.a)).toEqual(['1', '2']);
  });

  it('throws on an unterminated quoted field', () => {
    expect(() => parseCsv('a\n"oops')).toThrow();
  });
});

describe('validateImportRecords, clients', () => {
  it('accepts a complete row and normalizes types', () => {
    const { records } = parseCsv(
      'external_id,first_name,last_name,date_of_birth,medicaid_number,state,latitude,longitude,geofence_radius_m\n' +
        'C-1,Ada,Lovelace,1990-12-10,1234567890,pa,40.44,-79.99,200\n',
    );
    const [r] = validateImportRecords('clients', records);
    expect(r.status).toBe('ok');
    const v = r.value as ImportClientRow;
    expect(v.externalId).toBe('C-1');
    expect(v.state).toBe('PA');
    expect(v.latitude).toBe(40.44);
    expect(v.geofenceRadiusM).toBe(200);
  });

  it('flags missing required fields and bad dates', () => {
    const { records } = parseCsv('first_name,last_name,date_of_birth\n,Smith,not-a-date\n');
    const [r] = validateImportRecords('clients', records);
    expect(r.status).toBe('error');
    expect(r.errors.some((e) => e.includes('first_name'))).toBe(true);
    expect(r.errors.some((e) => e.includes('date_of_birth'))).toBe(true);
  });

  it('rejects a too-short medicaid number', () => {
    const { records } = parseCsv('first_name,last_name,date_of_birth,medicaid_number\nA,B,2000-01-01,123\n');
    const [r] = validateImportRecords('clients', records);
    expect(r.status).toBe('error');
    expect(r.errors.some((e) => e.includes('medicaid_number'))).toBe(true);
  });
});

describe('validateImportRecords, caregivers', () => {
  it('accepts a valid caregiver and lowercases email', () => {
    const { records } = parseCsv('first_name,last_name,email,npi\nGrace,Hopper,Grace@Navy.MIL,1234567890\n');
    const [r] = validateImportRecords('caregivers', records);
    expect(r.status).toBe('ok');
    const v = r.value as ImportCaregiverRow;
    expect(v.email).toBe('grace@navy.mil');
    expect(v.status).toBe('active');
  });

  it('flags a bad email and a non-10-digit NPI', () => {
    const { records } = parseCsv('first_name,last_name,email,npi\nA,B,not-an-email,12\n');
    const [r] = validateImportRecords('caregivers', records);
    expect(r.status).toBe('error');
    expect(r.errors.some((e) => e.includes('email'))).toBe(true);
    expect(r.errors.some((e) => e.includes('npi'))).toBe(true);
  });
});

describe('validateImportRecords, authorizations', () => {
  it('accepts a canonical service code and links via client_external_id', () => {
    const { records } = parseCsv(
      'external_id,client_external_id,payer_id,service_code,units_authorized,start_date,end_date\n' +
        'A-1,C-1,PA-MA,t1019,100,2026-06-01,2026-06-30\n',
    );
    const [r] = validateImportRecords('authorizations', records);
    expect(r.status).toBe('ok');
    const v = r.value as ImportAuthorizationRow;
    expect(v.serviceCode).toBe('T1019');
    expect(v.clientExternalId).toBe('C-1');
    expect(v.unitsAuthorized).toBe(100);
  });

  it('rejects a non-canonical (W-series) service code and end<start', () => {
    const { results } = parseAndValidate(
      'authorizations',
      'client_external_id,payer_id,service_code,units_authorized,start_date,end_date\n' +
        'C-1,PA-MA,W1793,100,2026-06-30,2026-06-01\n',
    );
    const r = results[0];
    expect(r.status).toBe('error');
    expect(r.errors.some((e) => e.includes('service_code'))).toBe(true);
    expect(r.errors.some((e) => e.includes('end_date'))).toBe(true);
  });

  it('requires client_external_id for linking', () => {
    const { results } = parseAndValidate(
      'authorizations',
      'payer_id,service_code,units_authorized,start_date,end_date\nPA-MA,T1019,5,2026-06-01,2026-06-30\n',
    );
    expect(results[0].status).toBe('error');
    expect(results[0].errors.some((e) => e.includes('client_external_id'))).toBe(true);
  });
});

describe('validateImportRecords, visits', () => {
  const HEADER =
    'external_id,client_external_id,caregiver_external_id,service_code,clock_in_time,clock_out_time,' +
    'clock_in_latitude,clock_in_longitude,clock_out_latitude,clock_out_longitude,status\n';

  it('accepts a complete historical visit and normalizes instants to ISO', () => {
    const { results } = parseAndValidate(
      'visits',
      HEADER + 'V-1,C-1,G-1,t1019,2024-03-01T09:00:00-05:00,2024-03-01T11:00:00-05:00,40.44,-79.99,40.44,-79.99,verified\n',
    );
    expect(results[0].status).toBe('ok');
    const v = results[0].value as ImportVisitRow;
    expect(v.serviceCode).toBe('T1019');
    expect(v.clockInTime).toBe('2024-03-01T14:00:00.000Z');
    expect(v.clockOutTime).toBe('2024-03-01T16:00:00.000Z');
    expect(v.clockInLatitude).toBe(40.44);
    expect(v.status).toBe('verified');
  });

  it('defaults status to verified and allows a missing clock-out and locations', () => {
    const { results } = parseAndValidate(
      'visits',
      HEADER + 'V-2,C-1,G-1,S5125,2024-03-02T09:00:00Z,,,,,,\n',
    );
    expect(results[0].status).toBe('ok');
    const v = results[0].value as ImportVisitRow;
    expect(v.status).toBe('verified');
    expect(v.clockOutTime).toBeUndefined();
    expect(v.clockInLatitude).toBeUndefined();
  });

  it('rejects a timezone-naive datetime (would be parsed as server-local time)', () => {
    const { results } = parseAndValidate(
      'visits',
      HEADER + 'V-9,C-1,G-1,T1019,2024-03-01T09:00:00,,,,,,\n',
    );
    expect(results[0].status).toBe('error');
    expect(results[0].errors.some((e) => e.includes('with timezone'))).toBe(true);
  });

  it('requires external_id, links, and a real ISO instant', () => {
    const { results } = parseAndValidate(
      'visits',
      HEADER + ',,,T1019,2024-03-01,,,,,,\n',
    );
    const r = results[0];
    expect(r.status).toBe('error');
    expect(r.errors.some((e) => e.includes('external_id is required'))).toBe(true);
    expect(r.errors.some((e) => e.includes('client_external_id'))).toBe(true);
    expect(r.errors.some((e) => e.includes('caregiver_external_id'))).toBe(true);
    // bare date is not a visit instant
    expect(r.errors.some((e) => e.includes('clock_in_time must be an ISO-8601'))).toBe(true);
  });

  it('rejects clock-out before clock-in, a lone latitude, and a bad status', () => {
    const { results } = parseAndValidate(
      'visits',
      HEADER + 'V-3,C-1,G-1,T1019,2024-03-01T11:00:00Z,2024-03-01T09:00:00Z,40.44,,,,billed\n',
    );
    const r = results[0];
    expect(r.status).toBe('error');
    expect(r.errors.some((e) => e.includes('clock_out_time must be after'))).toBe(true);
    expect(r.errors.some((e) => e.includes('provided together'))).toBe(true);
    expect(r.errors.some((e) => e.includes('status must be'))).toBe(true);
  });
});
