import { describe, expect, it } from 'vitest';
import {
  parseCsv,
  validateImportRecords,
  parseAndValidate,
  type ImportClientRow,
  type ImportCaregiverRow,
  type ImportAuthorizationRow,
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
