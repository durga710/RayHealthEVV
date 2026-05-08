import { z } from 'zod';
export declare const caregiverCredentialSchema: z.ZodObject<{
    caregiverId: z.ZodUnion<[z.ZodString, z.ZodString]>;
    credentialType: z.ZodEnum<{
        "tb-screening": "tb-screening";
        "background-check": "background-check";
        license: "license";
        training: "training";
    }>;
    status: z.ZodEnum<{
        active: "active";
        expired: "expired";
        pending: "pending";
    }>;
    expiresAt: z.ZodString;
}, z.core.$strip>;
export type CaregiverCredential = z.infer<typeof caregiverCredentialSchema>;
//# sourceMappingURL=staff.d.ts.map