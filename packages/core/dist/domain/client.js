import { z } from 'zod';
export const authorizationSchema = z.object({
    id: z.string().uuid().optional(),
    clientId: z.string().uuid().or(z.string().min(1)),
    payerId: z.string().uuid().or(z.string().min(1)),
    unitsAuthorized: z.number().positive(),
    serviceCode: z.string().min(1),
    startDate: z.string().date(),
    endDate: z.string().date()
});
export const clientSchema = z.object({
    id: z.string().uuid().optional(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    dateOfBirth: z.string().date(),
    medicaidNumber: z.string().min(10).optional()
});
//# sourceMappingURL=client.js.map