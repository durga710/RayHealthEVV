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
export interface Edi837Submitter {
    name: string;
    /** Submitter ETIN / id (ISA06 + NM1*41 id). */
    id: string;
    contactName?: string;
    contactPhone?: string;
}
export interface Edi837Receiver {
    name: string;
    /** Receiver id (ISA08 + NM1*40 id) — clearinghouse / payer interchange id. */
    id: string;
}
export interface Edi837BillingProvider {
    organizationName: string;
    /** 10-digit NPI. */
    npi: string;
    /** Employer ID Number (tax id). */
    taxId: string;
    address1: string;
    city: string;
    state: string;
    postalCode: string;
    /** Provider taxonomy code (optional PRV segment). */
    taxonomyCode?: string;
}
export interface Edi837Subscriber {
    firstName: string;
    lastName: string;
    /** Medicaid member id (NM1*IL). */
    memberId: string;
    /** YYYY-MM-DD. */
    dateOfBirth?: string;
    gender?: 'M' | 'F' | 'U';
    payerName: string;
    payerId: string;
}
export interface Edi837ServiceLine {
    /** HCPCS / service code. */
    serviceCode: string;
    chargeCents: number;
    units: number;
    /** YYYY-MM-DD date of service. */
    serviceDate: string;
    renderingProviderNpi?: string;
    renderingProviderLastName?: string;
    renderingProviderFirstName?: string;
}
export interface Edi837Claim {
    /** Patient control number (CLM01). */
    controlNumber: string;
    subscriber: Edi837Subscriber;
    /** Place-of-service code; defaults to 12 (home). */
    placeOfService?: string;
    /**
     * ICD-10-CM diagnosis codes for the claim, principal first. Sent in the
     * loop-2300 HI segment (ABK for the principal, ABF for each additional).
     * 005010X222A1 requires at least one diagnosis on a professional claim, and
     * every service line's diagnosis pointer must reference one of these. When
     * empty/omitted, NO HI segment is written and NO service-line diagnosis
     * pointer is emitted — so the file never carries a dangling pointer, though
     * such a claim will be rejected by the payer for the missing diagnosis until
     * the agency captures one.
     */
    diagnosisCodes?: string[];
    lines: Edi837ServiceLine[];
}
export interface Edi837Control {
    interchangeControlNumber?: string;
    groupControlNumber?: string;
    transactionControlNumber?: string;
    /** Interchange timestamp. Defaults to now; inject for deterministic output. */
    createdAt?: Date;
    /** 'P' production, 'T' test. Defaults to 'T'. */
    usageIndicator?: 'P' | 'T';
}
export interface Edi837Input {
    submitter: Edi837Submitter;
    receiver: Edi837Receiver;
    billingProvider: Edi837BillingProvider;
    claims: Edi837Claim[];
    control?: Edi837Control;
}
export interface Edi837Result {
    /** The full interchange as a single string (segment-terminated). */
    edi: string;
    /** Number of claims included. */
    claimCount: number;
    /** Total billed charge across all claims, in cents. */
    totalChargeCents: number;
    interchangeControlNumber: string;
}
/**
 * Build a complete 837P interchange for the given claims batch.
 */
export declare function generate837P(input: Edi837Input): Edi837Result;
//# sourceMappingURL=edi-837p.d.ts.map