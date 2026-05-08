import { z } from 'zod';
export declare const evvExceptionSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    visitId: z.ZodString;
    exceptionType: z.ZodEnum<{
        "late-clock-in": "late-clock-in";
        "missing-location": "missing-location";
        "telephony-fallback": "telephony-fallback";
        "manual-entry": "manual-entry";
    }>;
    reason: z.ZodString;
    approvedBy: z.ZodOptional<z.ZodString>;
    approvedAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EvvException = z.infer<typeof evvExceptionSchema>;
//# sourceMappingURL=evv-exception.d.ts.map