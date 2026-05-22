import { z } from 'zod';

/**
 * Visit Maintenance Unlock Request (VMUR) — the structured record of a
 * post-hoc visit correction submitted by an agency to its EVV aggregator.
 *
 * PA DHS via Sandata requires correction submissions to carry a reason
 * category code (drawn from an approved list, NOT free-text) plus a
 * correction code identifying what specifically changed about the visit.
 *
 * The lists below are the most commonly-cited PA DHS / Sandata codes.
 * Verify against the current Provider Spec before live submissions —
 * Sandata revises this list periodically.
 */

/**
 * PA DHS / Sandata reason category codes. The agency picks one when
 * submitting a correction. `OTHR` requires a free-text explanation in
 * `reason`.
 */
export const visitMaintenanceReasonCodes = [
  /** MTLB — Mobile (no internet at start of visit). */
  'MTLB',
  /** DCDB — Device damaged/broken. */
  'DCDB',
  /** MFLB — Manual entry, late submission. */
  'MFLB',
  /** MFLA — Manual entry, visit added after the fact. */
  'MFLA',
  /** ACLN — Client refused to use the app. */
  'ACLN',
  /** ATGL — GPS lookup failed at clock-in or clock-out. */
  'ATGL',
  /** AGRS — Aggregator/system upstream issue. */
  'AGRS',
  /** WKAP — Worker not available (substitute deployed). */
  'WKAP',
  /** CNCL — Visit cancelled by client. */
  'CNCL',
  /** HOLI — Holiday-related scheduling adjustment. */
  'HOLI',
  /** WKLI — Worker called in late. */
  'WKLI',
  /** OTHR — Other (requires free-text reason). */
  'OTHR',
] as const;

export const visitMaintenanceReasonCodeSchema = z.enum(visitMaintenanceReasonCodes);
export type VisitMaintenanceReasonCode = z.infer<typeof visitMaintenanceReasonCodeSchema>;

/**
 * Aggregator correction codes — what specifically changed about the visit.
 * Sandata's "VisitChange" schema is the canonical source; HHAeXchange uses
 * roughly parallel codes that map at export time.
 */
export const visitMaintenanceCorrectionCodes = [
  'TIME_CHANGE',
  'CAREGIVER_CHANGE',
  'CLIENT_CHANGE',
  'TASK_CHANGE',
  'VISIT_ADDED',
  'VISIT_CANCELED',
  'VISIT_VERIFIED',
  'OTHER',
] as const;

export const visitMaintenanceCorrectionCodeSchema = z.enum(visitMaintenanceCorrectionCodes);
export type VisitMaintenanceCorrectionCode = z.infer<typeof visitMaintenanceCorrectionCodeSchema>;

export const visitMaintenanceStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export const visitMaintenanceOriginatorRoleSchema = z.enum([
  'caregiver',
  'coordinator',
  'admin',
]);

export const visitMaintenanceSchema = z
  .object({
    id: z.string().uuid().optional(),
    visitId: z.string().uuid(),
    agencyId: z.string().uuid().optional(),
    requesterId: z.string().uuid(),
    /** Plain-language explanation. Required when reasonCategoryCode is OTHR. */
    reason: z.string().min(1),
    reasonCategoryCode: visitMaintenanceReasonCodeSchema.optional(),
    correctionCode: visitMaintenanceCorrectionCodeSchema.optional(),
    originatorRole: visitMaintenanceOriginatorRoleSchema.optional(),

    originalStartTime: z.string().datetime().optional(),
    originalEndTime: z.string().datetime().optional(),
    adjustedStartTime: z.string().datetime().optional(),
    adjustedEndTime: z.string().datetime().optional(),

    caregiverSignaturePresent: z.boolean().optional(),
    clientSignaturePresent: z.boolean().optional(),
    /** Required when caregiver_signature_present OR client_signature_present is false. */
    incompleteSignatureReason: z.string().optional(),

    status: visitMaintenanceStatusSchema.default('pending'),
    approverId: z.string().uuid().optional(),
    approvedAt: z.string().datetime().optional(),
  })
  .refine(
    (v) =>
      v.reasonCategoryCode !== 'OTHR' ||
      (v.reason && v.reason.trim().length > 0),
    {
      message: "reason is required when reasonCategoryCode is 'OTHR'",
      path: ['reason'],
    },
  )
  .refine(
    (v) => {
      // If either signature is explicitly missing, an incompleteSignatureReason
      // must be supplied so the correction can still be submitted to PA DHS
      // with documentation per the Provider Spec.
      const missingSig = v.caregiverSignaturePresent === false || v.clientSignaturePresent === false;
      if (!missingSig) return true;
      return Boolean(v.incompleteSignatureReason && v.incompleteSignatureReason.trim().length > 0);
    },
    {
      message: 'incompleteSignatureReason is required when a signature is missing',
      path: ['incompleteSignatureReason'],
    },
  );

export type VisitMaintenance = z.infer<typeof visitMaintenanceSchema>;
