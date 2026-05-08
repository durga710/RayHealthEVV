import { z } from 'zod';
/**
 * Mobile session row. Mobile auth uses JWT (kept for offline-friendly
 * client behaviour), but each issued token also gets a row here so the
 * server can revoke individual devices. The JWT's `jti` claim matches
 * `token_jti`; auth-context middleware rejects any bearer JWT whose jti
 * is absent or whose row has `revoked_at` set.
 */
export declare const mobileSessionSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    userId: z.ZodString;
    tokenJti: z.ZodString;
    deviceLabel: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodString;
    revokedAt: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type MobileSession = z.infer<typeof mobileSessionSchema>;
export type NewMobileSession = Omit<MobileSession, 'id' | 'revokedAt' | 'createdAt'>;
//# sourceMappingURL=mobile-session.d.ts.map