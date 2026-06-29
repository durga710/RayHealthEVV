import { describe, expect, it } from 'vitest';
import { computeReadinessChecklist, type ReadinessInputs } from './GoLiveReadinessPage.js';

const fullBilling = {
  billingNpi: '1234567890',
  billingTaxId: '123456789',
  billingAddress1: '1 Main St',
  billingCity: 'Philadelphia',
  billingState: 'PA',
  billingPostalCode: '19101',
};

const fullFees = { T1019: 600, S5125: 550, T1004: 700, T1021: 9000 };

const fullSandata = { providerId: '123456789', apiBaseUrl: 'https://x.example', hasCredentials: true, enabled: true };

function inputs(overrides: Partial<ReadinessInputs> = {}): ReadinessInputs {
  return {
    billing: fullBilling,
    fees: fullFees,
    sandata: fullSandata,
    clientCount: 1,
    staffCount: 1,
    ...overrides,
  };
}

function item(checklist: ReturnType<typeof computeReadinessChecklist>, fragment: string) {
  const found = checklist.find((c) => c.title.toLowerCase().includes(fragment));
  if (!found) throw new Error(`no checklist item matching "${fragment}"`);
  return found;
}

describe('computeReadinessChecklist', () => {
  it('marks every item done when fully configured', () => {
    const checklist = computeReadinessChecklist(inputs());
    expect(checklist.every((c) => c.done)).toBe(true);
  });

  it('flags fee schedule incomplete when any code is unpriced or zero', () => {
    const checklist = computeReadinessChecklist(inputs({ fees: { T1019: 600, S5125: 0, T1004: 700, T1021: 9000 } }));
    const fee = item(checklist, 'fee schedule');
    expect(fee.done).toBe(false);
    expect(fee.detail).toContain('3 of 4');
  });

  it('treats a missing fee code as unpriced', () => {
    const checklist = computeReadinessChecklist(inputs({ fees: { T1019: 600, T1004: 700, T1021: 9000 } }));
    expect(item(checklist, 'fee schedule').done).toBe(false);
  });

  it('requires every billing identity field', () => {
    const checklist = computeReadinessChecklist(inputs({ billing: { ...fullBilling, billingNpi: null } }));
    expect(item(checklist, 'billing identity').done).toBe(false);
  });

  it('requires Sandata to be enabled, not just configured', () => {
    const checklist = computeReadinessChecklist(inputs({ sandata: { ...fullSandata, enabled: false } }));
    expect(item(checklist, 'aggregator').done).toBe(false);
  });

  it('flags missing clients and staff', () => {
    const checklist = computeReadinessChecklist(inputs({ clientCount: 0, staffCount: 0 }));
    expect(item(checklist, 'client').done).toBe(false);
    expect(item(checklist, 'caregiver').done).toBe(false);
  });
});
