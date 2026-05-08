import { z } from 'zod';
export const sessionRoleSchema = z.enum(['admin', 'coordinator', 'caregiver', 'family']);
export const sessionSchema = z.object({
    id: z.string().uuid(),
    agencyId: z.string().uuid(),
    userId: z.string().uuid(),
    role: sessionRoleSchema,
    caregiverId: z.string().uuid().optional(),
    sessionTokenHash: z.string().length(64),
    csrfTokenHash: z.string().length(64),
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
    expiresAt: z.string().datetime(),
    revokedAt: z.string().datetime().optional(),
    createdAt: z.string().datetime().optional()
});
export const newSessionSchema = sessionSchema.omit({
    id: true,
    revokedAt: true,
    createdAt: true
});
//# sourceMappingURL=session.js.map