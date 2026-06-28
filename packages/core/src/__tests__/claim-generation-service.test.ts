import { describe, expect, it } from 'vitest';
import {
  computeBillingUnits,
  generateClaims,
  minutesBetween,
  serviceDateOf,
  type AuthorizationContext,
  type BillableVisit,
  type GenerateClaimsInput,
} from '../services/claim-generation-service.js';

// Deterministic id generator for stable assertions.
function seqIds(): () => string {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

const baseAuth: AuthorizationContext = {
  id: 'auth-1',
  clientId: 'client-1',
  payerId: 'PACHC',
  serviceCode: 'T1019',
  unitsAuthorized: 100,
  startDate: '2026-06-01',
  endDate: '2026-06-30',
};

function visit(overrides: Partial<BillableVisit> = {}): BillableVisit {
  // Spread (not ??) so an explicit `null` override is preserved rather than
  // falling back to the default.
  return {
    visitId: 'visit-1',
    clientId: 'client-1',
    caregiverId: 'cg-1',
    serviceCode: 'T1019',
    clockInTime: '2026-06-10T14:00:00.000Z',
    clockOutTime: '2026-06-10T15:00:00.000Z',
    status: 'verified',
    sandataStatus: 'accepted',
    clientMedicaidNumber: 'MA123456789',
    caregiverNpi: '1234567890',
    ...overrides,
  };
}

function input(overrides: Partial<GenerateClaimsInput> = {}): GenerateClaimsInput {
  return {
    agencyId: 'agency-1',
    periodStart: '2026-06-01',
    periodEnd: '2026-06-30',
    visits: overrides.visits ?? [visit()],
    authorizations: overrides.authorizations ?? [baseAuth],
    priorUnitsByAuth: overrides.priorUnitsByAuth,
    ratesByServiceCode:
      overrides.ratesByServiceCode ?? { T1019: 600, S5125: 600, T1004: 600, T1021: 5000 },
    newId: overrides.newId ?? seqIds(),
  };
}

describe('computeBillingUnits', () => {
  it('converts a one-hour T1019 visit into 4 fifteen-minute units', () => {
    expect(computeBillingUnits('T1019', 60)).toBe(4);
  });

  it('applies CMS 8-minute rounding (23 min -> 2 units, 22 min -> 1 unit)', () => {
    expect(computeBillingUnits('T1019', 23)).toBe(2);
    expect(computeBillingUnits('T1019', 22)).toBe(1);
  });

  it('returns 0 units for a sub-8-minute visit (never rounds up)', () => {
    expect(computeBillingUnits('T1019', 5)).toBe(0);
  });

  it('bills per-visit codes (T1021) as exactly 1 unit regardless of duration', () => {
    expect(computeBillingUnits('T1021', 200)).toBe(1);
    expect(computeBillingUnits('T1021', 5)).toBe(1);
  });
});

describe('minutesBetween / serviceDateOf', () => {
  it('computes whole minutes', () => {
    expect(minutesBetween('2026-06-10T14:00:00Z', '2026-06-10T15:30:00Z')).toBe(90);
  });
  it('derives the UTC date of service', () => {
    expect(serviceDateOf('2026-06-10T23:30:00Z')).toBe('2026-06-10');
  });
});

describe('generateClaims', () => {
  it('produces a clean low-risk claim for a verified, authorized visit', () => {
    const { claims, unbillable } = generateClaims(input());
    expect(unbillable).toHaveLength(0);
    expect(claims).toHaveLength(1);
    const claim = claims[0];
    expect(claim.clientId).toBe('client-1');
    expect(claim.payerId).toBe('PACHC');
    expect(claim.status).toBe('draft');
    expect(claim.totalUnits).toBe(4);
    expect(claim.denialRisk).toBe('low');
    expect(claim.lines).toHaveLength(1);
    expect(claim.lines[0].denialReasons).toHaveLength(0);
    expect(claim.lines[0].chargeCents).toBe(2400); // 4 units * 600 cents
    expect(claim.totalChargeCents).toBe(2400);
    expect(claim.lines[0].claimId).toBe(claim.id);
    expect(claim.controlNumber).toMatch(/^[0-9A-F]{12}$/);
  });

  it('flags a $0 line (medium risk) when no fee-schedule rate is configured', () => {
    const { claims } = generateClaims(input({ ratesByServiceCode: {} }));
    expect(claims).toHaveLength(1);
    const line = claims[0].lines[0];
    expect(line.chargeCents).toBe(0);
    expect(line.denialRisk).toBe('medium');
    expect(line.denialReasons.some((r) => r.includes('fee-schedule rate'))).toBe(true);
  });

  it('reports a visit with no matching authorization as unbillable', () => {
    const { claims, unbillable } = generateClaims(
      input({ visits: [visit({ clockInTime: '2026-07-10T14:00:00Z', clockOutTime: '2026-07-10T15:00:00Z' })] }),
    );
    expect(claims).toHaveLength(0);
    expect(unbillable).toHaveLength(1);
    expect(unbillable[0].reasons[0]).toMatch(/No active T1019 authorization/);
  });

  it('flags an unverified visit as high denial risk', () => {
    const { claims } = generateClaims(input({ visits: [visit({ status: 'flagged' })] }));
    expect(claims[0].denialRisk).toBe('high');
    expect(claims[0].lines[0].denialReasons.join(' ')).toMatch(/not EVV-verified/);
  });

  it('flags units exceeding remaining authorized units', () => {
    const { claims } = generateClaims(
      input({
        authorizations: [{ ...baseAuth, unitsAuthorized: 2 }],
        visits: [visit()], // 4 units vs 2 authorized
      }),
    );
    expect(claims[0].denialRisk).toBe('high');
    expect(claims[0].lines[0].denialReasons.join(' ')).toMatch(/exceed the remaining authorized units/);
  });

  it('honors prior billed units when computing remaining authorization', () => {
    const { claims } = generateClaims(
      input({
        authorizations: [{ ...baseAuth, unitsAuthorized: 6 }],
        priorUnitsByAuth: { 'auth-1': 4 }, // only 2 remaining, visit bills 4
        visits: [visit()],
      }),
    );
    expect(claims[0].lines[0].denialReasons.join(' ')).toMatch(/exceed the remaining authorized units/);
  });

  it('flags a missing client Medicaid id and missing NPI', () => {
    const { claims } = generateClaims(
      input({ visits: [visit({ clientMedicaidNumber: null, caregiverNpi: null })] }),
    );
    const reasons = claims[0].lines[0].denialReasons.join(' ');
    expect(reasons).toMatch(/Medicaid ID is missing/);
    expect(reasons).toMatch(/NPI is missing/);
    expect(claims[0].denialRisk).toBe('high');
  });

  it('treats a not-yet-accepted Sandata visit as medium risk', () => {
    const { claims } = generateClaims(input({ visits: [visit({ sandataStatus: 'pending' })] }));
    expect(claims[0].denialRisk).toBe('medium');
    expect(claims[0].lines[0].denialReasons.join(' ')).toMatch(/not yet accepted by the state EVV aggregator/);
  });

  it('groups multiple visits for one client+payer into a single claim, summing units', () => {
    const { claims } = generateClaims(
      input({
        visits: [
          visit({ visitId: 'v1', clockInTime: '2026-06-10T14:00:00Z', clockOutTime: '2026-06-10T15:00:00Z' }),
          visit({ visitId: 'v2', clockInTime: '2026-06-11T14:00:00Z', clockOutTime: '2026-06-11T15:00:00Z' }),
        ],
      }),
    );
    expect(claims).toHaveLength(1);
    expect(claims[0].lines).toHaveLength(2);
    expect(claims[0].totalUnits).toBe(8);
  });

  it('splits visits across separate claims by payer', () => {
    const { claims } = generateClaims(
      input({
        authorizations: [
          baseAuth,
          { ...baseAuth, id: 'auth-2', clientId: 'client-2', payerId: 'AETNA' },
        ],
        visits: [
          visit({ visitId: 'v1', clientId: 'client-1' }),
          visit({ visitId: 'v2', clientId: 'client-2' }),
        ],
      }),
    );
    expect(claims).toHaveLength(2);
    expect(new Set(claims.map((c) => c.payerId))).toEqual(new Set(['PACHC', 'AETNA']));
  });

  it('reports a visit with no clock-out as unbillable', () => {
    const { claims, unbillable } = generateClaims(
      input({ visits: [visit({ clockOutTime: null })] }),
    );
    expect(claims).toHaveLength(0);
    expect(unbillable[0].reasons[0]).toMatch(/no clock-out/);
  });
});
