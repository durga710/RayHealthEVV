import { z } from 'zod';
export declare const visitMaintenanceSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    visitId: z.ZodString;
    requesterId: z.ZodString;
    reason: z.ZodString;
    originalStartTime: z.ZodOptional<z.ZodString>;
    originalEndTime: z.ZodOptional<z.ZodString>;
    adjustedStartTime: z.ZodOptional<z.ZodString>;
    adjustedEndTime: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<{
        pending: "pending";
        approved: "approved";
        rejected: "rejected";
    }>>;
}, z.core.$strip>;
export type VisitMaintenance = z.infer<typeof visitMaintenanceSchema>;
//# sourceMappingURL=visit-maintenance.d.ts.map