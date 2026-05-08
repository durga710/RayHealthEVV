import { z } from 'zod';
export const agencySchema = z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1),
    state: z.string().refine((val) => val === 'PA', {
        message: 'Agency must be located in Pennsylvania'
    }),
    operatingTracks: z.array(z.enum(['personal-assistance', 'home-health'])).min(1),
    medicaidProviderNumber: z.string().min(6).optional()
});
//# sourceMappingURL=agency.js.map