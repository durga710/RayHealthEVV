import { z } from 'zod';
import { paServiceCodes } from '../config/pennsylvania.js';

/**
 * Billing / claims domain.
 *
 * A {@link Claim} aggregates one client's GPS-verified visits over a service
 * period into a payer claim. Each {@link ClaimLine} corresponds to exactly one
 * verified EVV visit (one date of service), so every billed line is traceable
 * back to an immutable `evv_visits` row, the core integrity property of the
 * product: a claim line should only exist behind a verified visit.
 *
 * Money is stored in integer cents to avoid float drift. Charge amounts are
 * OPTIONAL (default 0 / "unpriced"): RayHealth is the verification + claim
 * assembly layer, and the payer fee schedule determines the paid amount, so we
 * never invent dollar rates. Units (HCPCS units of measure) are always
 * computed and validated.
 */

/** Claim lifecycle. Mirrors the real X12 837 → 277CA → 835 round-trip. */
export const claimStatuses = [
  'draft', // generated from visits, not yet validated
  'ready', // validated + passes pre-submission checks
  'submitted', // 837 produced and handed to the clearinghouse
  'accepted', // clearinghouse/payer front-end accepted (277CA)
  'rejected', // front-end rejected before adjudication
  'denied', // adjudicated and denied (835)
  'paid', // adjudicated and paid (835)
  'void', // cancelled before submission
] as const;
export type ClaimStatus = (typeof claimStatuses)[number];

/** Terminal statuses a claim can never transition out of. */
export const terminalClaimStatuses: readonly ClaimStatus[] = ['paid', 'void'];

/** Denial-risk band assigned by pre-submission scoring. */
export const denialRiskLevels = ['low', 'medium', 'high'] as const;
export type DenialRiskLevel = (typeof denialRiskLevels)[number];

const yyyyMmDd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

export const claimLineSchema = z.object({
  id: z.string().uuid().optional(),
  claimId: z.string().uuid().optional(),
  /** The verified EVV visit this line bills for. */
  visitId: z.string().uuid(),
  serviceCode: z.enum(paServiceCodes),
  /** Date of service (visit clock-in date), YYYY-MM-DD. */
  serviceDate: yyyyMmDd,
  /** Billing units (HCPCS units of measure). */
  units: z.number().int().nonnegative(),
  /** Verified service duration in minutes (audit trail for the unit math). */
  minutes: z.number().int().nonnegative(),
  /** Charge amount in integer cents. 0 = unpriced (payer fee schedule applies). */
  chargeCents: z.number().int().nonnegative().default(0),
  denialRisk: z.enum(denialRiskLevels).default('low'),
  /** Human-readable denial-risk flags surfaced before submission. */
  denialReasons: z.array(z.string()).default([]),
});
export type ClaimLine = z.infer<typeof claimLineSchema>;

export const claimSchema = z.object({
  id: z.string().uuid().optional(),
  agencyId: z.string().uuid(),
  clientId: z.string().uuid(),
  /** Payer identifier carried from the authorization (payer_id). */
  payerId: z.string().min(1),
  periodStart: yyyyMmDd,
  periodEnd: yyyyMmDd,
  status: z.enum(claimStatuses).default('draft'),
  totalUnits: z.number().int().nonnegative().default(0),
  totalChargeCents: z.number().int().nonnegative().default(0),
  /** Worst denial-risk band across the claim's lines. */
  denialRisk: z.enum(denialRiskLevels).default('low'),
  /** Patient control number (CLM01 in the 837). Stable per claim. */
  controlNumber: z.string().optional(),
  /** Payer/clearinghouse claim id, populated after an accept. */
  payerClaimId: z.string().nullable().optional(),
  /** Rejection / denial reason text, populated on rejected/denied. */
  statusReason: z.string().nullable().optional(),
  submittedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  lines: z.array(claimLineSchema).default([]),
});
export type Claim = z.infer<typeof claimSchema>;

/** Allowed manual status transitions (admin-driven, post-generation). */
export const allowedClaimTransitions: Record<ClaimStatus, readonly ClaimStatus[]> = {
  draft: ['ready', 'void'],
  ready: ['submitted', 'void', 'draft'],
  submitted: ['accepted', 'rejected', 'denied', 'paid'],
  accepted: ['paid', 'denied'],
  rejected: ['ready', 'void'],
  denied: ['ready', 'void'],
  paid: [],
  void: [],
};

export function canTransitionClaim(from: ClaimStatus, to: ClaimStatus): boolean {
  return allowedClaimTransitions[from]?.includes(to) ?? false;
}
