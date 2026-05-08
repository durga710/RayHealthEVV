import { z } from 'zod';
export const evvVisitSchema = z.object({
    id: z.string().uuid().optional(),
    assignmentId: z.string().uuid(),
    caregiverId: z.string().uuid(),
    // Cures-Act #2 (beneficiary) — snapshotted onto the row at clock-in.
    clientId: z.string().uuid().optional(),
    // Cures-Act #1 (type of service) — HCPCS code stamped at clock-in.
    serviceCode: z.enum(['T1019', 'S5125', 'T1004', 'T1021']).optional(),
    clockInTime: z.string().datetime(),
    clockOutTime: z.string().datetime().optional(),
    clockInLocation: z.object({
        lat: z.number(),
        lng: z.number(),
        accuracy: z.number()
    }),
    clockOutLocation: z.object({
        lat: z.number(),
        lng: z.number(),
        accuracy: z.number()
    }).optional(),
    status: z.enum(['pending', 'verified', 'flagged']).default('pending')
});
//# sourceMappingURL=evv.js.map