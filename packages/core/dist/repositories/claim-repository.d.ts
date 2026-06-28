import type { Knex } from 'knex';
import type { Claim, ClaimStatus } from '../domain/billing.js';
import type { AuthorizationContext, BillableVisit } from '../services/claim-generation-service.js';
import type { PayrollVisit } from '../services/payroll-export-service.js';
import type { Era835 } from '../services/edi-835.js';
export interface EraPostResult {
    posted: number;
    matched: number;
    unmatched: string[];
}
/**
 * Persistence for generated Medicaid claims (`claims` + `claim_lines`).
 *
 * Every query is agency-scoped. Claim creation is transactional (claim header
 * plus all lines, all-or-nothing). The repository also exposes the read paths
 * the generation route needs to avoid double-billing: which visits are already
 * on a live claim, and how many units have already been billed per
 * client/service-code/date (so remaining-authorization checks stay accurate
 * across runs).
 */
export interface ClaimListFilter {
    status?: ClaimStatus;
    clientId?: string;
    limit?: number;
    offset?: number;
}
/** A claim header plus its line count (no lines) — for list views. */
export interface ClaimSummary extends Omit<Claim, 'lines'> {
    lineCount: number;
}
export interface ClaimStatusPatch {
    status: ClaimStatus;
    statusReason?: string | null;
    payerClaimId?: string | null;
    submittedAt?: string | null;
}
/** A prior-billed line, used to reconstruct remaining authorized units. */
export interface BilledLineUnits {
    clientId: string;
    serviceCode: string;
    serviceDate: string;
    units: number;
}
/** Agency billing-provider identity for the 837 (2010AA loop). */
export interface AgencyBillingProfile {
    name: string;
    npi: string;
    taxId: string;
    address1: string;
    city: string;
    state: string;
    postalCode: string;
    taxonomyCode?: string;
    clearinghouseId: string;
    medicaidProviderNumber: string;
}
export interface ClientBillingInfo {
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    medicaidNumber: string;
}
export interface RenderingProvider {
    firstName: string;
    lastName: string;
    npi: string;
}
export declare class ClaimRepository {
    private readonly db;
    constructor(db: Knex);
    /** Transactionally insert claims and their lines. Returns the stored claims. */
    createClaims(claims: readonly Claim[]): Promise<Claim[]>;
    listClaims(agencyId: string, filter?: ClaimListFilter): Promise<{
        rows: ClaimSummary[];
        total: number;
    }>;
    getClaim(agencyId: string, id: string): Promise<Claim | null>;
    private getClaimInTrx;
    /** Update a claim's status. Returns the updated claim, or null if not found. */
    updateStatus(agencyId: string, id: string, patch: ClaimStatusPatch): Promise<Claim | null>;
    /**
     * Which of these patient-control-numbers match an existing claim for the
     * agency. Read-only — used to preview an 835 before posting it.
     */
    matchControlNumbers(agencyId: string, controlNumbers: string[]): Promise<Set<string>>;
    /** Recent remittance postings for the agency (newest first), for the UI list. */
    listRemittances(agencyId: string, limit?: number): Promise<Array<{
        id: string;
        claimId: string | null;
        controlNumber: string;
        matched: boolean;
        statusCode: string | null;
        chargeCents: number;
        paidCents: number;
        adjustmentCents: number;
        patientResponsibilityCents: number;
        traceNumber: string | null;
        postedAt: string | null;
    }>>;
    /**
     * Post an 835 remittance: for every CLP claim in the file, record a
     * `claim_remittances` row and — when its control_number matches one of our
     * claims — advance that claim's status (paid / denied / rejected), paid_cents,
     * payer_claim_id, and a CAS-derived status_reason. Unmatched postings are
     * kept with claim_id NULL so nothing in the file is silently dropped. Runs in
     * one transaction (all-or-nothing).
     */
    postEra(agencyId: string, era: Era835): Promise<EraPostResult>;
    /**
     * Visit ids already carried by a non-void claim for this agency. The
     * generation path excludes these so a visit is never billed twice.
     */
    getActiveClaimVisitIds(agencyId: string): Promise<Set<string>>;
    /**
     * Units already billed (non-void claims) per client/service-code/date — used
     * to reconstruct remaining authorized units across prior generation runs.
     */
    getBilledLineUnits(agencyId: string): Promise<BilledLineUnits[]>;
    /**
     * Verified-or-not visits in [startIso, endIso] for the agency, joined to
     * client (decrypted Medicaid id) and caregiver (decrypted NPI). The
     * generation service decides billability; this just supplies the rows.
     */
    getBillableVisits(agencyId: string, startIso: string, endIso: string): Promise<BillableVisit[]>;
    /** Active + historical authorizations for the agency's clients. */
    getAgencyAuthorizations(agencyId: string): Promise<AuthorizationContext[]>;
    /** Visits in [startIso, endIso] for payroll aggregation (caregiver scope). */
    getPayrollVisits(agencyId: string, startIso: string, endIso: string): Promise<PayrollVisit[]>;
    /** Agency billing-provider identity for the 837 (R14 columns). */
    getAgencyBillingProfile(agencyId: string): Promise<AgencyBillingProfile | null>;
    /** Per-client subscriber info for the 837 subscriber loop. */
    getClientBillingInfo(agencyId: string, clientIds: readonly string[]): Promise<Map<string, ClientBillingInfo>>;
    /** Per-visit rendering provider (caregiver) for the 837 service lines. */
    getVisitRenderingProviders(visitIds: readonly string[]): Promise<Map<string, RenderingProvider>>;
    private mapClaim;
    private mapLine;
}
//# sourceMappingURL=claim-repository.d.ts.map