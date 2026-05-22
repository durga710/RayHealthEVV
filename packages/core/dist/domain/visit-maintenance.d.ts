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
export declare const visitMaintenanceReasonCodes: readonly ["MTLB", "DCDB", "MFLB", "MFLA", "ACLN", "ATGL", "AGRS", "WKAP", "CNCL", "HOLI", "WKLI", "OTHR"];
export declare const visitMaintenanceReasonCodeSchema: z.ZodEnum<{
    MTLB: "MTLB";
    DCDB: "DCDB";
    MFLB: "MFLB";
    MFLA: "MFLA";
    ACLN: "ACLN";
    ATGL: "ATGL";
    AGRS: "AGRS";
    WKAP: "WKAP";
    CNCL: "CNCL";
    HOLI: "HOLI";
    WKLI: "WKLI";
    OTHR: "OTHR";
}>;
export type VisitMaintenanceReasonCode = z.infer<typeof visitMaintenanceReasonCodeSchema>;
/**
 * Aggregator correction codes — what specifically changed about the visit.
 * Sandata's "VisitChange" schema is the canonical source; HHAeXchange uses
 * roughly parallel codes that map at export time.
 */
export declare const visitMaintenanceCorrectionCodes: readonly ["TIME_CHANGE", "CAREGIVER_CHANGE", "CLIENT_CHANGE", "TASK_CHANGE", "VISIT_ADDED", "VISIT_CANCELED", "VISIT_VERIFIED", "OTHER"];
export declare const visitMaintenanceCorrectionCodeSchema: z.ZodEnum<{
    TIME_CHANGE: "TIME_CHANGE";
    CAREGIVER_CHANGE: "CAREGIVER_CHANGE";
    CLIENT_CHANGE: "CLIENT_CHANGE";
    TASK_CHANGE: "TASK_CHANGE";
    VISIT_ADDED: "VISIT_ADDED";
    VISIT_CANCELED: "VISIT_CANCELED";
    VISIT_VERIFIED: "VISIT_VERIFIED";
    OTHER: "OTHER";
}>;
export type VisitMaintenanceCorrectionCode = z.infer<typeof visitMaintenanceCorrectionCodeSchema>;
export declare const visitMaintenanceStatusSchema: z.ZodEnum<{
    pending: "pending";
    rejected: "rejected";
    approved: "approved";
}>;
export declare const visitMaintenanceOriginatorRoleSchema: z.ZodEnum<{
    admin: "admin";
    coordinator: "coordinator";
    caregiver: "caregiver";
}>;
export declare const visitMaintenanceSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    visitId: z.ZodString;
    agencyId: z.ZodOptional<z.ZodString>;
    requesterId: z.ZodString;
    reason: z.ZodString;
    reasonCategoryCode: z.ZodOptional<z.ZodEnum<{
        MTLB: "MTLB";
        DCDB: "DCDB";
        MFLB: "MFLB";
        MFLA: "MFLA";
        ACLN: "ACLN";
        ATGL: "ATGL";
        AGRS: "AGRS";
        WKAP: "WKAP";
        CNCL: "CNCL";
        HOLI: "HOLI";
        WKLI: "WKLI";
        OTHR: "OTHR";
    }>>;
    correctionCode: z.ZodOptional<z.ZodEnum<{
        TIME_CHANGE: "TIME_CHANGE";
        CAREGIVER_CHANGE: "CAREGIVER_CHANGE";
        CLIENT_CHANGE: "CLIENT_CHANGE";
        TASK_CHANGE: "TASK_CHANGE";
        VISIT_ADDED: "VISIT_ADDED";
        VISIT_CANCELED: "VISIT_CANCELED";
        VISIT_VERIFIED: "VISIT_VERIFIED";
        OTHER: "OTHER";
    }>>;
    originatorRole: z.ZodOptional<z.ZodEnum<{
        admin: "admin";
        coordinator: "coordinator";
        caregiver: "caregiver";
    }>>;
    originalStartTime: z.ZodOptional<z.ZodString>;
    originalEndTime: z.ZodOptional<z.ZodString>;
    adjustedStartTime: z.ZodOptional<z.ZodString>;
    adjustedEndTime: z.ZodOptional<z.ZodString>;
    caregiverSignaturePresent: z.ZodOptional<z.ZodBoolean>;
    clientSignaturePresent: z.ZodOptional<z.ZodBoolean>;
    incompleteSignatureReason: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<{
        pending: "pending";
        rejected: "rejected";
        approved: "approved";
    }>>;
    approverId: z.ZodOptional<z.ZodString>;
    approvedAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type VisitMaintenance = z.infer<typeof visitMaintenanceSchema>;
//# sourceMappingURL=visit-maintenance.d.ts.map