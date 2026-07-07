import { describe, expect, it } from 'vitest';
import { generate837P } from '../services/edi-837p.js';
function baseInput(overrides = {}) {
    return {
        submitter: { name: 'RAYHEALTH EVV', id: 'RAYHEALTH1', contactName: 'Billing', contactPhone: '5705551234' },
        receiver: { name: 'PA MEDICAID', id: 'PROMISE' },
        billingProvider: {
            organizationName: 'SUNRISE HOME CARE',
            npi: '1234567893',
            taxId: '12-3456789',
            address1: '100 MAIN ST',
            city: 'SCRANTON',
            state: 'PA',
            postalCode: '18503',
            taxonomyCode: '251E00000X',
        },
        claims: [
            {
                controlNumber: 'CLM00000001',
                subscriber: {
                    firstName: 'JANE',
                    lastName: 'DOE',
                    memberId: 'MA123456789',
                    dateOfBirth: '1955-04-12',
                    gender: 'F',
                    payerName: 'PA MEDICAID',
                    payerId: 'PROMISE',
                },
                lines: [
                    {
                        serviceCode: 'T1019',
                        chargeCents: 8000,
                        units: 4,
                        serviceDate: '2026-06-10',
                        renderingProviderNpi: '1987654321',
                        renderingProviderLastName: 'SMITH',
                        renderingProviderFirstName: 'ALEX',
                    },
                ],
            },
        ],
        control: {
            createdAt: new Date('2026-06-28T13:45:00.000Z'),
            interchangeControlNumber: '42',
            groupControlNumber: '42',
            transactionControlNumber: '1',
            usageIndicator: 'T',
        },
        ...overrides,
    };
}
function segments(edi) {
    return edi.split('~').filter(Boolean);
}
describe('generate837P', () => {
    it('emits a valid envelope: ISA/GS/ST … SE/GE/IEA', () => {
        const { edi } = generate837P(baseInput());
        const segs = segments(edi);
        expect(segs[0]).toMatch(/^ISA\*/);
        expect(segs[1]).toMatch(/^GS\*HC\*/);
        expect(segs[2]).toMatch(/^ST\*837\*0001\*005010X222A1$/);
        expect(segs[segs.length - 3]).toMatch(/^SE\*/);
        expect(segs[segs.length - 2]).toMatch(/^GE\*1\*42$/);
        expect(segs[segs.length - 1]).toMatch(/^IEA\*1\*000000042$/);
    });
    it('writes a 105-char fixed-width ISA segment with padded ids', () => {
        const { edi } = generate837P(baseInput());
        const isa = segments(edi)[0];
        expect(isa.length).toBe(105);
        // ISA13 control number is right-justified, zero-padded to 9.
        expect(isa).toContain('000000042');
        // ISA15 usage indicator + component separator at the tail.
        expect(isa.endsWith('*T*:')).toBe(true);
    });
    it('computes the SE segment count over ST..SE inclusive', () => {
        const segs = segments(generate837P(baseInput()).edi);
        const stIdx = segs.findIndex((s) => s.startsWith('ST*'));
        const seIdx = segs.findIndex((s) => s.startsWith('SE*'));
        const declared = Number(segs[seIdx].split('*')[1]);
        expect(declared).toBe(seIdx - stIdx + 1);
    });
    it('renders the billing provider, subscriber, payer and claim loops', () => {
        const { edi } = generate837P(baseInput());
        expect(edi).toContain('NM1*85*2*SUNRISE HOME CARE*****XX*1234567893');
        expect(edi).toContain('N3*100 MAIN ST');
        expect(edi).toContain('N4*SCRANTON*PA*18503');
        expect(edi).toContain('REF*EI*123456789');
        expect(edi).toContain('NM1*IL*1*DOE*JANE****MI*MA123456789');
        expect(edi).toContain('DMG*D8*19550412*F');
        expect(edi).toContain('NM1*PR*2*PA MEDICAID*****PI*PROMISE');
        expect(edi).toContain('CLM*CLM00000001*80.00');
    });
    it('renders the service line with HCPCS code, units and date of service', () => {
        const { edi } = generate837P(baseInput());
        expect(edi).toContain('LX*1');
        expect(edi).toContain('SV1*HC:T1019*80.00*UN*4*12');
        expect(edi).toContain('DTP*472*D8*20260610');
        expect(edi).toContain('NM1*82*1*SMITH*ALEX****XX*1987654321');
    });
    it('totals charges across claims and reports claimCount', () => {
        const input = baseInput();
        input.claims.push({
            controlNumber: 'CLM00000002',
            subscriber: { firstName: 'JOHN', lastName: 'ROE', memberId: 'MA987', payerName: 'PA MEDICAID', payerId: 'PROMISE' },
            lines: [{ serviceCode: 'S5125', chargeCents: 4500, units: 3, serviceDate: '2026-06-11' }],
        });
        const r = generate837P(input);
        expect(r.claimCount).toBe(2);
        expect(r.totalChargeCents).toBe(12500);
    });
    it('renders 0.00 charges for unpriced lines (no fee schedule loaded)', () => {
        const input = baseInput();
        input.claims[0].lines[0].chargeCents = 0;
        const { edi } = generate837P(input);
        expect(edi).toContain('SV1*HC:T1019*0.00*UN*4*12');
        expect(edi).toContain('CLM*CLM00000001*0.00');
    });
    it('strips X12 delimiter characters from free-text fields', () => {
        const input = baseInput();
        input.claims[0].subscriber.lastName = 'O*BRIEN~JR';
        const { edi } = generate837P(input);
        expect(edi).toContain('NM1*IL*1*O BRIEN JR*JANE');
    });
    it('emits an HI diagnosis segment and a matching SV1 pointer when diagnosis codes are present', () => {
        const input = baseInput();
        // Decimal point is dropped for X12; principal first (ABK), then ABF.
        input.claims[0].diagnosisCodes = ['Z74.1', 'E11.9'];
        const { edi } = generate837P(input);
        expect(edi).toContain('HI*ABK:Z741*ABF:E119');
        // The HI segment sits inside the 2300 claim loop, after CLM, before LX.
        const clmIdx = edi.indexOf('CLM*');
        const hiIdx = edi.indexOf('HI*ABK:');
        const lxIdx = edi.indexOf('LX*1');
        expect(clmIdx).toBeLessThan(hiIdx);
        expect(hiIdx).toBeLessThan(lxIdx);
        // Service line carries the diagnosis pointer to diagnosis #1.
        expect(edi).toContain('SV1*HC:T1019*80.00*UN*4*12**1');
    });
    it('omits the HI segment AND the dangling diagnosis pointer when no diagnosis is present', () => {
        // baseInput() supplies no diagnosisCodes.
        const { edi } = generate837P(baseInput());
        expect(edi).not.toContain('HI*ABK:');
        // No trailing "**1" diagnosis pointer referencing a non-existent diagnosis.
        expect(edi).toContain('SV1*HC:T1019*80.00*UN*4*12~');
        expect(edi).not.toContain('SV1*HC:T1019*80.00*UN*4*12**1');
    });
});
//# sourceMappingURL=edi-837p.test.js.map