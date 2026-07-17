import { describe, expect, it } from 'vitest';
import { CredentialComplianceService } from '../services/credential-compliance-service.js';
import type { CaregiverCredential } from '../domain/caregiver.js';

/** YYYY-MM-DD, `days` from now (negative = past). */
function dateFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function cred(overrides: Partial<CaregiverCredential>): CaregiverCredential {
  return {
    id: 'cred-1',
    caregiverId: 'caregiver-1',
    credentialType: 'tb-screening',
    status: 'active',
    expiresAt: dateFromNow(365),
    ...overrides,
  } as CaregiverCredential;
}

/** All four required PA types, active and far from expiry. */
function fullSet(): CaregiverCredential[] {
  return (['tb-screening', 'background-check', 'license', 'training'] as const).map((t, i) =>
    cred({ id: `cred-${i}`, credentialType: t }),
  );
}

const service = new CredentialComplianceService();

describe('CredentialComplianceService.evaluate', () => {
  it('is compliant with a full, current credential set', () => {
    const result = service.evaluate(fullSet());
    expect(result.compliant).toBe(true);
    expect(result.expired).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
  });

  it('treats a past expiry date as expired even when status is still active', () => {
    const stale = cred({ expiresAt: dateFromNow(-1) });
    const result = service.evaluate([stale]);
    expect(result.expired).toEqual([stale]);
    expect(result.compliant).toBe(false);
  });

  it('reports required PA types with no credential on file as missing', () => {
    const result = service.evaluate([cred({ credentialType: 'license' })]);
    expect(result.missing).toEqual(['tb-screening', 'background-check', 'training']);
  });
});

describe('CredentialComplianceService.gateForBooking', () => {
  it('passes cleanly for a full, current credential set', () => {
    expect(service.gateForBooking(fullSet())).toEqual({ blocks: [], warnings: [] });
  });

  it('blocks when a credential is expired by status', () => {
    const set = fullSet();
    set[0] = cred({ id: set[0].id, credentialType: 'tb-screening', status: 'expired' });
    const gate = service.gateForBooking(set);
    expect(gate.blocks).toHaveLength(1);
    expect(gate.blocks[0]).toContain('expired');
    expect(gate.blocks[0]).toContain('tb-screening');
  });

  it('blocks when a credential lapsed by date, whatever its status says', () => {
    const set = fullSet();
    set[1] = cred({ id: set[1].id, credentialType: 'background-check', expiresAt: dateFromNow(-3) });
    const gate = service.gateForBooking(set);
    expect(gate.blocks).toHaveLength(1);
    expect(gate.blocks[0]).toContain('background-check');
  });

  it('only warns when required credentials are missing (onboarding must not freeze)', () => {
    const gate = service.gateForBooking([]);
    expect(gate.blocks).toHaveLength(0);
    expect(gate.warnings).toHaveLength(1);
    expect(gate.warnings[0]).toContain('no tb-screening, background-check, license, training');
  });

  it('warns when a credential expires within the 30-day window', () => {
    const set = fullSet();
    set[2] = cred({ id: set[2].id, credentialType: 'license', expiresAt: dateFromNow(10) });
    const gate = service.gateForBooking(set);
    expect(gate.blocks).toHaveLength(0);
    expect(gate.warnings.some((w) => w.includes('expire within 30 days') && w.includes('license'))).toBe(true);
  });

  it('warns on pending verification, but reports a date-lapsed pending credential as expired instead', () => {
    const set = fullSet();
    set[3] = cred({ id: set[3].id, credentialType: 'training', status: 'pending' });
    const pendingGate = service.gateForBooking(set);
    expect(pendingGate.blocks).toHaveLength(0);
    expect(pendingGate.warnings.some((w) => w.includes('pending verification') && w.includes('training'))).toBe(true);

    set[3] = cred({ id: set[3].id, credentialType: 'training', status: 'pending', expiresAt: dateFromNow(-1) });
    const lapsedGate = service.gateForBooking(set);
    expect(lapsedGate.blocks).toHaveLength(1);
    expect(lapsedGate.warnings.some((w) => w.includes('pending verification'))).toBe(false);
  });
});
