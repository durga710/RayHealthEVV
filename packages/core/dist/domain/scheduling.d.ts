import { z } from 'zod';
export declare const assignmentStatusSchema: z.ZodEnum<{
    scheduled: "scheduled";
    completed: "completed";
    cancelled: "cancelled";
}>;
export type AssignmentStatus = z.infer<typeof assignmentStatusSchema>;
export declare const assignmentInputSchema: z.ZodObject<{
    caregiverId: z.ZodString;
    visitTemplateId: z.ZodString;
    credentialStatus: z.ZodLiteral<"active">;
    visitDate: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AssignmentInput = z.infer<typeof assignmentInputSchema>;
//# sourceMappingURL=scheduling.d.ts.map