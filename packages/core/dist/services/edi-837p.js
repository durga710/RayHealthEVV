/**
 * X12 837P (Professional) EDI generator — ASC X12N 005010X222A1.
 *
 * Produces a structurally valid 837P interchange (ISA/GS/ST … SE/GE/IEA) from
 * a batch of claims. This is the real Health Care Claim: Professional format
 * that clearinghouses and PA Medicaid (PROMISe / Sandata) consume.
 *
 * Scope + honesty: this builds the FILE. Actually transmitting it requires a
 * clearinghouse / trading-partner account and payer EDI enrollment (external
 * credentials the agency provides). The generated file is what an agency
 * uploads to that clearinghouse portal, or what an automated SFTP/API
 * connector would send once configured. Dollar amounts come straight from each
 * line's chargeCents — if an agency hasn't loaded a fee schedule, charges are
 * 0.00 and the upstream validation flags that before submission.
 *
 * Pure + deterministic: all control numbers and the interchange timestamp are
 * injectable so the output is byte-stable in tests.
 */
const ELEMENT = '*';
const SEGMENT = '~';
const SUBELEMENT = ':';
const REPETITION = '^';
function money(cents) {
    return (Math.max(0, Math.round(cents)) / 100).toFixed(2);
}
function ccyymmdd(dateYmd) {
    return dateYmd.replace(/-/g, '');
}
function pad(value, len) {
    return value.length >= len ? value.slice(0, len) : value + ' '.repeat(len - value.length);
}
function rjustNum(value, len) {
    const digits = value.replace(/\D/g, '').slice(-len);
    return digits.padStart(len, '0');
}
/** Strip characters X12 reserves as delimiters from free-text data. */
function clean(value) {
    return (value ?? '').replace(/[*~:^]/g, ' ').trim();
}
/**
 * Normalize an ICD-10-CM code for X12: uppercase, drop the decimal point
 * (X12 carries the code without it) and strip anything that isn't
 * alphanumeric. Returns '' for a blank/invalid input so the caller can skip it.
 */
function icd10(value) {
    return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function seg(...elements) {
    // Drop trailing empty elements for a tidy segment.
    let end = elements.length;
    while (end > 1 && elements[end - 1] === '')
        end -= 1;
    return elements.slice(0, end).join(ELEMENT) + SEGMENT;
}
/**
 * Build a complete 837P interchange for the given claims batch.
 */
export function generate837P(input) {
    const now = input.control?.createdAt ?? new Date();
    const iso = now.toISOString();
    const yymmdd = iso.slice(2, 10).replace(/-/g, '');
    const ccyy = iso.slice(0, 10).replace(/-/g, '');
    const hhmm = iso.slice(11, 16).replace(':', '');
    const icn = rjustNum(input.control?.interchangeControlNumber ?? '1', 9);
    const gcn = (input.control?.groupControlNumber ?? '1').replace(/\D/g, '') || '1';
    const tcn = rjustNum(input.control?.transactionControlNumber ?? '1', 4);
    const usage = input.control?.usageIndicator ?? 'T';
    const bp = input.billingProvider;
    // ISA is fixed-width and positional.
    const isa = [
        'ISA',
        '00',
        pad('', 10),
        '00',
        pad('', 10),
        'ZZ',
        pad(clean(input.submitter.id).toUpperCase(), 15),
        'ZZ',
        pad(clean(input.receiver.id).toUpperCase(), 15),
        yymmdd,
        hhmm,
        REPETITION,
        '00501',
        icn,
        '0',
        usage,
        SUBELEMENT,
    ].join(ELEMENT) + SEGMENT;
    const gs = seg('GS', 'HC', clean(input.submitter.id).toUpperCase(), clean(input.receiver.id).toUpperCase(), ccyy, hhmm, gcn, 'X', '005010X222A1');
    // Transaction segments (ST … SE). SE count covers ST through SE inclusive.
    const tx = [];
    tx.push(seg('ST', '837', tcn, '005010X222A1'));
    tx.push(seg('BHT', '0019', '00', `RH${icn}`, ccyy, hhmm, 'CH'));
    // 1000A Submitter
    tx.push(seg('NM1', '41', '2', clean(input.submitter.name), '', '', '', '', '46', clean(input.submitter.id).toUpperCase()));
    tx.push(seg('PER', 'IC', clean(input.submitter.contactName ?? input.submitter.name), 'TE', (input.submitter.contactPhone ?? '').replace(/\D/g, '') || '0000000000'));
    // 1000B Receiver
    tx.push(seg('NM1', '40', '2', clean(input.receiver.name), '', '', '', '', '46', clean(input.receiver.id).toUpperCase()));
    // 2000A Billing Provider HL
    let hl = 1;
    tx.push(seg('HL', String(hl), '', '20', '1'));
    if (bp.taxonomyCode) {
        tx.push(seg('PRV', 'BI', 'PXC', clean(bp.taxonomyCode)));
    }
    // 2010AA Billing Provider Name
    tx.push(seg('NM1', '85', '2', clean(bp.organizationName), '', '', '', '', 'XX', rjustNum(bp.npi, 10)));
    tx.push(seg('N3', clean(bp.address1)));
    tx.push(seg('N4', clean(bp.city), clean(bp.state).toUpperCase(), bp.postalCode.replace(/\D/g, '')));
    tx.push(seg('REF', 'EI', bp.taxId.replace(/\D/g, '')));
    let totalChargeCents = 0;
    for (const claim of input.claims) {
        const sub = claim.subscriber;
        const pos = (claim.placeOfService ?? '12').replace(/\D/g, '') || '12';
        const claimChargeCents = claim.lines.reduce((s, l) => s + Math.max(0, Math.round(l.chargeCents)), 0);
        totalChargeCents += claimChargeCents;
        // 2000B Subscriber HL (child of billing provider HL 1)
        hl += 1;
        tx.push(seg('HL', String(hl), '1', '22', '0'));
        // Subscriber is the patient (Medicaid recipient): SBR*P*18*…*MC
        tx.push(seg('SBR', 'P', '18', '', '', '', '', '', '', 'MC'));
        // 2010BA Subscriber Name
        tx.push(seg('NM1', 'IL', '1', clean(sub.lastName), clean(sub.firstName), '', '', '', 'MI', clean(sub.memberId)));
        if (sub.dateOfBirth) {
            tx.push(seg('DMG', 'D8', ccyymmdd(sub.dateOfBirth), sub.gender ?? 'U'));
        }
        // 2010BB Payer Name
        tx.push(seg('NM1', 'PR', '2', clean(sub.payerName), '', '', '', '', 'PI', clean(sub.payerId)));
        // 2300 Claim
        tx.push(seg('CLM', clean(claim.controlNumber), money(claimChargeCents), '', '', `${pos}${SUBELEMENT}B${SUBELEMENT}1`, 'Y', 'A', 'Y', 'Y'));
        // 2300 Health Care Diagnosis Code (HI). Required for a professional claim:
        // the principal diagnosis rides in ABK, each additional in ABF. We only
        // emit the segment — and the matching service-line diagnosis pointer below —
        // when at least one valid code is present, so the file never contains a
        // pointer to a diagnosis that isn't declared.
        const diagnoses = (claim.diagnosisCodes ?? []).map(icd10).filter(Boolean);
        if (diagnoses.length > 0) {
            const hiElements = diagnoses
                .slice(0, 12) // 005010X222A1 caps the HI diagnosis list at 12
                .map((code, idx) => `${idx === 0 ? 'ABK' : 'ABF'}${SUBELEMENT}${code}`);
            tx.push(seg('HI', ...hiElements));
        }
        // SV107 composite diagnosis-code pointer — points at the principal
        // diagnosis (position 1 in the HI segment). Omitted entirely when the claim
        // has no diagnosis, leaving no dangling reference.
        const diagnosisPointer = diagnoses.length > 0 ? '1' : '';
        // 2400 Service lines
        let lx = 0;
        for (const line of claim.lines) {
            lx += 1;
            tx.push(seg('LX', String(lx)));
            tx.push(seg('SV1', `HC${SUBELEMENT}${clean(line.serviceCode)}`, money(line.chargeCents), 'UN', String(line.units), pos, '', diagnosisPointer));
            tx.push(seg('DTP', '472', 'D8', ccyymmdd(line.serviceDate)));
            if (line.renderingProviderNpi) {
                tx.push(seg('NM1', '82', '1', clean(line.renderingProviderLastName ?? ''), clean(line.renderingProviderFirstName ?? ''), '', '', '', 'XX', rjustNum(line.renderingProviderNpi, 10)));
            }
        }
    }
    // SE count = ST through SE inclusive (tx currently holds ST..last line; +1 for SE).
    const seSegment = seg('SE', String(tx.length + 1), tcn);
    tx.push(seSegment);
    const ge = seg('GE', '1', gcn);
    const iea = seg('IEA', '1', icn);
    const edi = [isa, gs, ...tx, ge, iea].join('');
    return {
        edi,
        claimCount: input.claims.length,
        totalChargeCents,
        interchangeControlNumber: icn,
    };
}
//# sourceMappingURL=edi-837p.js.map