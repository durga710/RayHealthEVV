import { z } from 'zod';
export declare const agencySchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    state: z.ZodString & z.ZodType<"PA", string, z.core.$ZodTypeInternals<"PA", string>>;
    operatingTracks: z.ZodArray<z.ZodEnum<{
        "personal-assistance": "personal-assistance";
        "home-health": "home-health";
    }>>;
    medicaidProviderNumber: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Agency = z.infer<typeof agencySchema>;
//# sourceMappingURL=agency.d.ts.map