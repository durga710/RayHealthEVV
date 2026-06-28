import { describe, expect, it } from 'vitest';
import {
  parse835,
  eraStatusToClaimStatus,
  summarizeAdjustments,
} from '../services/edi-835.js';

// A minimal 835 (no ISA envelope → default '*' element / '~' segment seps):
// one paid claim with a contractual adjustment, one denied claim.
const ERA_835 = [
  'ST*835*0001~',
  'BPR*I*450.00*C*ACH*CCP*01*021000021*DA*123*1512345678~',
  'TRN*1*CHK-9001*1512345678~',
  'CLP*CLAIM-001*1*500.00*450.00*50.00*MC*PAYERCLM-1*11~',
  'CAS*CO*45*50.00~',
  'CLP*CLAIM-002*4*300.00*0*0*MC*PAYERCLM-2*11~',
  'CAS*CO*97*300.00~',
  'SE*7*0001~',
].join('');

describe('parse835', () => {
  it('parses trace, total paid, and per-claim payment detail', () => {
    const era = parse835(ERA_835);
    expect(era.traceNumber).toBe('CHK-9001');
    expect(era.totalPaidCents).toBe(45000);
    expect(era.claims).toHaveLength(2);

    const paid = era.claims[0];
    expect(paid.controlNumber).toBe('CLAIM-001');
    expect(paid.chargeCents).toBe(50000);
    expect(paid.paidCents).toBe(45000);
    expect(paid.patientResponsibilityCents).toBe(5000);
    expect(paid.payerClaimControlNumber).toBe('PAYERCLM-1');
    expect(paid.derivedStatus).toBe('partial'); // paid < charge
    expect(paid.adjustments).toEqual([{ group: 'CO', reasonCode: '45', amountCents: 5000 }]);

    const denied = era.claims[1];
    expect(denied.statusCode).toBe('4');
    expect(denied.derivedStatus).toBe('denied');
    expect(denied.paidCents).toBe(0);
  });

  it('tolerates newline-delimited segments', () => {
    const era = parse835('CLP*A1*1*100.00*100.00*0~\nCAS*CO*45*0~');
    expect(era.claims).toHaveLength(1);
    expect(era.claims[0].derivedStatus).toBe('paid');
  });

  it('throws on a file with no CLP segments', () => {
    expect(() => parse835('ST*835*0001~\nSE*1*0001~')).toThrow();
  });

  it('maps derived status to a claim status', () => {
    expect(eraStatusToClaimStatus('paid')).toBe('paid');
    expect(eraStatusToClaimStatus('partial')).toBe('paid');
    expect(eraStatusToClaimStatus('denied')).toBe('denied');
    expect(eraStatusToClaimStatus('reversed')).toBe('rejected');
  });

  it('summarizes adjustments into a reason string', () => {
    expect(summarizeAdjustments([{ group: 'CO', reasonCode: '45', amountCents: 5000 }])).toBe(
      'CO/45: $50.00',
    );
    expect(summarizeAdjustments([])).toBeNull();
  });
});
