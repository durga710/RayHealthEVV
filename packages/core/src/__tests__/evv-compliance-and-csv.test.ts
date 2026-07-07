import { describe, expect, it } from 'vitest';
import { EvvComplianceService } from '../services/evv-compliance-service.js';
import { toHhaexchangeCsv, type HhaexchangeCsvRow } from '../services/hhaexchange-mapping.js';
import type { EvvVisit } from '../domain/evv.js';

function visit(overrides: Partial<EvvVisit> = {}): EvvVisit {
  return {
    id: 'v1',
    assignmentId: 'a1',
    caregiverId: 'c1',
    clientId: 'cl1',
    serviceCode: 'T1019',
    clockInTime: '2026-06-10T09:00:00.000Z',
    clockOutTime: '2026-06-10T13:00:00.000Z',
    clockInLocation: { lat: 40.44, lng: -79.99, accuracy: 10 },
    clockOutLocation: { lat: 40.44, lng: -79.99, accuracy: 10 },
    status: 'verified',
    ...overrides,
  } as EvvVisit;
}

describe('EvvComplianceService — coordinate 0 handling (finding #15)', () => {
  it('does NOT treat lat/lng of exactly 0 as a missing location', () => {
    const result = new EvvComplianceService().validate(
      visit({ clockInLocation: { lat: 0, lng: 0, accuracy: 10 } }),
    );
    expect(result.missingElements).not.toContain('location');
  });

  it('still flags a genuinely absent location', () => {
    const result = new EvvComplianceService().validate(
      visit({ clockInLocation: undefined as unknown as EvvVisit['clockInLocation'] }),
    );
    expect(result.missingElements).toContain('location');
  });
});

describe('CSV formula injection neutralization (finding #12)', () => {
  function row(overrides: Partial<HhaexchangeCsvRow> = {}): HhaexchangeCsvRow {
    return {
      AgencyTaxID: '123456789',
      ProviderID: 'P1',
      EmployeeID: 'E1',
      MemberID: 'M1',
      MemberFirstName: 'Jane',
      MemberLastName: 'Doe',
      ServiceStart: '2026-06-10T09:00',
      ServiceEnd: '2026-06-10T13:00',
      ServiceCode: 'T1019',
      ClockInLat: '40.44',
      ClockInLng: '-79.99',
      ClockOutLat: '40.44',
      ClockOutLng: '-79.99',
      ...overrides,
    };
  }

  it('prefixes a formula-triggering name so a spreadsheet treats it as text', () => {
    const csv = toHhaexchangeCsv([row({ MemberFirstName: '=HYPERLINK("http://evil")' })]);
    // Neutralized with a leading single quote (and RFC-quoted for the comma).
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).not.toContain(',=HYPERLINK');
  });

  it('leaves ordinary names untouched', () => {
    const csv = toHhaexchangeCsv([row({ MemberFirstName: 'Jane' })]);
    expect(csv).toContain(',Jane,');
  });
});
