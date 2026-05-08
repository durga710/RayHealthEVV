import { z } from 'zod';
export declare const evvVisitSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    assignmentId: z.ZodString;
    caregiverId: z.ZodString;
    clientId: z.ZodOptional<z.ZodString>;
    serviceCode: z.ZodOptional<z.ZodEnum<{
        T1019: "T1019";
        S5125: "S5125";
        T1004: "T1004";
        T1021: "T1021";
    }>>;
    clockInTime: z.ZodString;
    clockOutTime: z.ZodOptional<z.ZodString>;
    clockInLocation: z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
        accuracy: z.ZodNumber;
    }, z.core.$strip>;
    clockOutLocation: z.ZodOptional<z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
        accuracy: z.ZodNumber;
    }, z.core.$strip>>;
    status: z.ZodDefault<z.ZodEnum<{
        pending: "pending";
        verified: "verified";
        flagged: "flagged";
    }>>;
}, z.core.$strip>;
export type EvvVisit = z.infer<typeof evvVisitSchema>;
//# sourceMappingURL=evv.d.ts.map