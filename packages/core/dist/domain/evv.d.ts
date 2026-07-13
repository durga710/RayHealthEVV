import { z } from 'zod';
export declare const evvVisitIdSchema: z.ZodString;
export declare const evvServiceCodeSchema: z.ZodEnum<{
    T1019: "T1019";
    S5125: "S5125";
    T1004: "T1004";
    T1021: "T1021";
}>;
export declare const evvLocationSchema: z.ZodObject<{
    lat: z.ZodNumber;
    lng: z.ZodNumber;
    accuracy: z.ZodNumber;
}, z.core.$strip>;
export declare const evvCaptureModeSchema: z.ZodEnum<{
    online: "online";
    offline: "offline";
}>;
export declare const evvClockInInputSchema: z.ZodObject<{
    clientEventId: z.ZodOptional<z.ZodString>;
    occurredAt: z.ZodOptional<z.ZodString>;
    captureMode: z.ZodOptional<z.ZodEnum<{
        online: "online";
        offline: "offline";
    }>>;
    assignmentId: z.ZodString;
    visitId: z.ZodOptional<z.ZodString>;
    location: z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
        accuracy: z.ZodNumber;
    }, z.core.$strip>;
    serviceCode: z.ZodOptional<z.ZodEnum<{
        T1019: "T1019";
        S5125: "S5125";
        T1004: "T1004";
        T1021: "T1021";
    }>>;
}, z.core.$strip>;
export declare const evvClockOutInputSchema: z.ZodObject<{
    clientEventId: z.ZodOptional<z.ZodString>;
    occurredAt: z.ZodOptional<z.ZodString>;
    captureMode: z.ZodOptional<z.ZodEnum<{
        online: "online";
        offline: "offline";
    }>>;
    location: z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
        accuracy: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
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
    clockInClientEventId: z.ZodOptional<z.ZodString>;
    clockOutClientEventId: z.ZodOptional<z.ZodString>;
    clockInCaptureMode: z.ZodOptional<z.ZodEnum<{
        online: "online";
        offline: "offline";
    }>>;
    clockOutCaptureMode: z.ZodOptional<z.ZodEnum<{
        online: "online";
        offline: "offline";
    }>>;
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
    sandataStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        pending: "pending";
        accepted: "accepted";
        submitted: "submitted";
        rejected: "rejected";
    }>>>;
    sandataConfirmationId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type EvvVisit = z.infer<typeof evvVisitSchema>;
export type EvvClockInInput = z.infer<typeof evvClockInInputSchema>;
export type EvvClockOutInput = z.infer<typeof evvClockOutInputSchema>;
//# sourceMappingURL=evv.d.ts.map