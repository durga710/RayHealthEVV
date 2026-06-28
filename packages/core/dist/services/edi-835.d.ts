/**
 * ERA / 835 remittance parser.
 *
 * The back half of the billing loop. After we send an 837P claim, the payer
 * returns an 835 Electronic Remittance Advice telling us, per claim, what was
 * charged / paid / adjusted / denied. This module parses the 835 EDI text into
 * structured per-claim records that the posting path matches back onto our
 * claims (by the patient control number we put in CLM01 → echoed in CLP01).
 *
 * Pragmatic scope: we read the segments that carry claim-level money and
 * identity — BPR (total paid), TRN (check/EFT trace), CLP (claim payment), and
 * CAS (adjustments). Service-line (SVC) detail is summarized at the claim level
 * via CAS. Separators are auto-detected from the ISA envelope when present, and
 * otherwise default to '*' (element) and '~' (segment); newlines are tolerated.
 */
export interface Era835Adjustment {
    group: string;
    reasonCode: string;
    amountCents: number;
}
export type Era835DerivedStatus = 'paid' | 'partial' | 'denied' | 'reversed';
export interface Era835Claim {
    controlNumber: string;
    statusCode: string;
    chargeCents: number;
    paidCents: number;
    patientResponsibilityCents: number;
    payerClaimControlNumber: string | null;
    adjustments: Era835Adjustment[];
    derivedStatus: Era835DerivedStatus;
}
export interface Era835 {
    traceNumber: string | null;
    totalPaidCents: number;
    claims: Era835Claim[];
}
/**
 * Parse 835 EDI text into a structured remittance. Throws if the file contains
 * no CLP (claim payment) segments — i.e. it isn't a recognizable 835.
 */
export declare function parse835(text: string): Era835;
/** Map an 835 derived status to a claim row status. */
export declare function eraStatusToClaimStatus(s: Era835DerivedStatus): 'paid' | 'denied' | 'rejected';
/** Human-readable reason string built from CAS adjustments (for status_reason). */
export declare function summarizeAdjustments(adjustments: Era835Adjustment[]): string | null;
//# sourceMappingURL=edi-835.d.ts.map