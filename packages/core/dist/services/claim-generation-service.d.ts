import { type PaServiceCode } from '../config/pennsylvania.js';
import type { Claim } from '../domain/billing.js';
/**
 * Claim generation service (pure).
 *
 * Turns GPS-verified EVV visits into payer claims, validating every line
 * against the client's Medicaid authorization and scoring its denial risk
 * BEFORE submission. This is the regulated core of the billing module, so it
 * is intentionally free of DB/IO: callers fetch the rows, hand them in as plain
 * objects, and persist the result. That keeps it exhaustively unit-testable and
 * deterministic.
 *
 * Integrity rules enforced here:
 *   - A line is only billable behind a clocked-out, EVV-verified visit.
 *   - Units never silently exceed the remaining authorized units.
 *   - A visit with no active authorization is reported as unbillable, never
 *     quietly billed.
 */
export interface BillableVisit {
    visitId: string;
    clientId: string;
    caregiverId: string;
    serviceCode: PaServiceCode | null;
    /** ISO-8601 clock-in (date of service is derived from this, in UTC). */
    clockInTime: string;
    /** ISO-8601 clock-out, or null if the visit never completed. */
    clockOutTime: string | null;
    status: 'pending' | 'verified' | 'flagged';
    /** State-aggregator (Sandata) lifecycle, if known. */
    sandataStatus?: string | null;
    /** Decrypted client Medicaid id (required for a clean claim). */
    clientMedicaidNumber?: string | null;
    /** Rendering caregiver NPI (decrypted), if known. */
    caregiverNpi?: string | null;
}
export interface AuthorizationContext {
    id: string;
    clientId: string;
    payerId: string;
    serviceCode: string;
    unitsAuthorized: number;
    /** YYYY-MM-DD inclusive window. */
    startDate: string;
    endDate: string;
}
export interface GenerateClaimsInput {
    agencyId: string;
    periodStart: string;
    periodEnd: string;
    visits: readonly BillableVisit[];
    authorizations: readonly AuthorizationContext[];
    /** Units already billed per authorization id across prior claims. */
    priorUnitsByAuth?: Readonly<Record<string, number>>;
    /**
     * Contracted fee schedule: cents per billing unit, keyed by HCPCS service
     * code. When a visit's service code has no rate the line charges $0 and is
     * flagged — a claim can't be sent to a payer at $0.
     */
    ratesByServiceCode?: Readonly<Record<string, number>>;
    /** Injectable id generator (deterministic in tests). */
    newId?: () => string;
}
export interface UnbillableVisit {
    visitId: string;
    clientId: string;
    reasons: string[];
}
export interface GenerateClaimsResult {
    claims: Claim[];
    unbillable: UnbillableVisit[];
}
/** UTC calendar date (YYYY-MM-DD) of an ISO timestamp. */
export declare function serviceDateOf(iso: string): string;
/** Whole minutes between two ISO timestamps, floored at 0. */
export declare function minutesBetween(startIso: string, endIso: string): number;
/**
 * Convert a verified duration into HCPCS billing units.
 *
 *   - Per-visit codes (unitMinutes === 0, e.g. T1021): always 1 unit.
 *   - 15-minute codes: CMS "8-minute rule" — round to the nearest whole unit
 *     (round-half-up). A visit under ~8 minutes yields 0 units and is flagged
 *     downstream as below the minimum billable increment, rather than rounded
 *     up (we never over-bill Medicaid).
 */
export declare function computeBillingUnits(serviceCode: PaServiceCode, minutes: number): number;
/**
 * Generate draft claims from a set of visits, grouped by (client, payer).
 * Returns the claims plus the list of visits that could not be billed and why.
 */
export declare function generateClaims(input: GenerateClaimsInput): GenerateClaimsResult;
//# sourceMappingURL=claim-generation-service.d.ts.map