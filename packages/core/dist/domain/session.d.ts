import { z } from 'zod';
export declare const sessionRoleSchema: z.ZodEnum<{
    admin: "admin";
    coordinator: "coordinator";
    caregiver: "caregiver";
    family: "family";
}>;
export declare const sessionSchema: z.ZodObject<{
    id: z.ZodString;
    agencyId: z.ZodString;
    activeAgencyId: z.ZodOptional<z.ZodString>;
    userId: z.ZodString;
    role: z.ZodEnum<{
        admin: "admin";
        coordinator: "coordinator";
        caregiver: "caregiver";
        family: "family";
    }>;
    caregiverId: z.ZodOptional<z.ZodString>;
    sessionTokenHash: z.ZodString;
    csrfTokenHash: z.ZodString;
    userAgent: z.ZodOptional<z.ZodString>;
    ipAddress: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodString;
    revokedAt: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const newSessionSchema: z.ZodObject<{
    role: z.ZodEnum<{
        admin: "admin";
        coordinator: "coordinator";
        caregiver: "caregiver";
        family: "family";
    }>;
    agencyId: z.ZodString;
    activeAgencyId: z.ZodOptional<z.ZodString>;
    userId: z.ZodString;
    caregiverId: z.ZodOptional<z.ZodString>;
    sessionTokenHash: z.ZodString;
    csrfTokenHash: z.ZodString;
    userAgent: z.ZodOptional<z.ZodString>;
    ipAddress: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodString;
}, z.core.$strip>;
export type Session = z.infer<typeof sessionSchema>;
export type NewSession = z.infer<typeof newSessionSchema>;
//# sourceMappingURL=session.d.ts.map