import { z } from 'zod';
import { paServiceCodes } from '../config/pennsylvania.js';
export const authorizationSchema = z.object({
    id: z.string().uuid().optional(),
    clientId: z.string().uuid().or(z.string().min(1)),
    payerId: z.string().uuid().or(z.string().min(1)),
    unitsAuthorized: z.number().positive(),
    // Must be a canonical PA HCPCS code. EVV visits and 837 claim lines only
    // carry these codes (evv_visits_service_code_check enforces the same set),
    // so an authorization in any other code (e.g. the W-series program codes)
    // would never match a visit and its units would never burn down.
    serviceCode: z.enum(paServiceCodes),
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