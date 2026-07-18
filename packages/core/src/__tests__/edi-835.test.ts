import { describe, expect, it } from 'vitest';
import {
  parse835,
  allAdjustments,
  eraStatusToClaimStatus,
  summarizeAdjustments,
} from '../services/edi-835.js';
import { adjustmentGroupLabel, describeCarc, describeRarc } from '../services/carc-rarc.js';

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

  it('summarizes adjustments with the CARC description when known', () => {
    expect(summarizeAdjustments([{ group: 'CO', reasonCode: '45', amountCents: 5000 }])).toBe(
      'CO/45 (Charge exceeds fee schedule / maximum allowable amount): $50.00',
    );
    // Unknown code falls back to the bare code, never breaks.
    expect(summarizeAdjustments([{ group: 'OA', reasonCode: '999', amountCents: 100 }])).toBe(
      'OA/999: $1.00',
    );
    expect(summarizeAdjustments([])).toBeNull();
  });

  it('parses SVC service lines with their own CAS, DTM*472 date, and LQ remarks', () => {
    const era = parse835(
      [
        'CLP*CLAIM-010*2*400.00*300.00*0*MC*PAYERCLM-10*11~',
        'MOA***N362~',
        'SVC*HC:T1019:U1*250.00*200.00**10~',
        'DTM*472*20260601~',
        'CAS*CO*45*50.00~',
        'LQ*HE*N362~',
        'SVC*HC:S5125*150.00*100.00**6~',
        'DTM*472*20260602~',
        'CAS*PR*1*50.00~',
      ].join(''),
    );
    const claim = era.claims[0];
    expect(claim.remarkCodes).toEqual(['N362']);
    // Line-level CAS attaches to the line, not the claim header.
    expect(claim.adjustments).toEqual([]);
    expect(claim.lines).toHaveLength(2);

    const [l1, l2] = claim.lines;
    expect(l1.procedureCode).toBe('T1019');
    expect(l1.modifiers).toEqual(['U1']);
    expect(l1.chargeCents).toBe(25000);
    expect(l1.paidCents).toBe(20000);
    expect(l1.units).toBe(10);
    expect(l1.serviceDate).toBe('2026-06-01');
    expect(l1.adjustments).toEqual([{ group: 'CO', reasonCode: '45', amountCents: 5000 }]);
    expect(l1.remarkCodes).toEqual(['N362']);

    expect(l2.procedureCode).toBe('S5125');
    expect(l2.modifiers).toEqual([]);
    expect(l2.adjustments).toEqual([{ group: 'PR', reasonCode: '1', amountCents: 5000 }]);

    // The roll-up sees claim-level + every line's adjustments.
    expect(allAdjustments(claim)).toHaveLength(2);
  });

  it('honors the ISA16-declared component separator for SVC composites', () => {
    // Valid 106-char ISA declaring '>' as the component separator (index 104).
    const isa =
      'ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *260701*1200*^*00501*000000001*0*P*>~';
    const era = parse835(
      isa + 'CLP*CLAIM-030*1*100.00*100.00*0~' + 'SVC*HC>T1019>U1*100.00*100.00**4~',
    );
    expect(era.claims[0].lines[0].procedureCode).toBe('T1019');
    expect(era.claims[0].lines[0].modifiers).toEqual(['U1']);
  });

  it('resets the line scope at the next CLP so CAS lands on the new claim header', () => {
    const era = parse835(
      [
        'CLP*CLAIM-020*1*100.00*100.00*0~',
        'SVC*HC:T1019*100.00*100.00**4~',
        'CLP*CLAIM-021*4*200.00*0*0~',
        'CAS*CO*197*200.00~',
      ].join(''),
    );
    expect(era.claims[1].adjustments).toEqual([
      { group: 'CO', reasonCode: '197', amountCents: 20000 },
    ]);
    expect(era.claims[1].lines).toHaveLength(0);
  });
});

describe('CARC / RARC dictionary', () => {
  it('describes common CARCs and RARCs, null for unknown codes', () => {
    expect(describeCarc('45')).toContain('fee schedule');
    expect(describeCarc('197')).toContain('authorization');
    expect(describeCarc('b7')).toContain('certified');
    expect(describeCarc('999')).toBeNull();
    expect(describeRarc('N362')).toContain('units of service exceeds');
    expect(describeRarc('ma130')).toContain('unprocessable');
    expect(describeRarc('ZZ99')).toBeNull();
  });

  it('labels adjustment groups', () => {
    expect(adjustmentGroupLabel('CO')).toBe('Contractual obligation');
    expect(adjustmentGroupLabel('PR')).toBe('Patient responsibility');
    expect(adjustmentGroupLabel('XX')).toBe('XX');
  });
});
