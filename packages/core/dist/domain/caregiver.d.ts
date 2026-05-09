import { z } from 'zod';
export declare const caregiverSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    agencyId: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    email: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    npi: z.ZodOptional<z.ZodString>;
    hireDate: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
        suspended: "suspended";
    }>>;
}, z.core.$strip>;
export type Caregiver = z.infer<typeof caregiverSchema>;
export declare const caregiverCredentialSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    caregiverId: z.ZodUnion<[z.ZodString, z.ZodString]>;
    credentialType: z.ZodEnum<{
        "tb-screening": "tb-screening";
        "background-check": "background-check";
        license: "license";
        training: "training";
    }>;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        expired: "expired";
        pending: "pending";
    }>>;
    expiresAt: z.ZodString;
    issuedAt: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CaregiverCredential = z.infer<typeof caregiverCredentialSchema>;
export declare const staffInviteSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    agencyId: z.ZodString;
    email: z.ZodString;
    role: z.ZodEnum<{
        admin: "admin";
        coordinator: "coordinator";
        caregiver: "caregiver";
        family: "family";
    }>;
    status: z.ZodDefault<z.ZodEnum<{
        expired: "expired";
        pending: "pending";
        accepted: "accepted";
    }>>;
    invitedBy: z.ZodString;
    expiresAt: z.ZodString;
}, z.core.$strip>;
export type StaffInvite = z.infer<typeof staffInviteSchema>;
export type PersistedStaffInvite = StaffInvite & {
    id: string;
};
//# sourceMappingURL=caregiver.d.ts.map