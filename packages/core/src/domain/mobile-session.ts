import { z } from 'zod';

/**
 * Mobile session row. Mobile auth uses JWT (kept for offline-friendly
 * client behaviour), but each issued token also gets a row here so the
 * server can revoke individual devices. The JWT's `jti` claim matches
 * `token_jti`; auth-context middleware rejects any bearer JWT whose jti
 * is absent or whose row has `revoked_at` set.
 */
export const mobileSessionSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid(),
  tokenJti: z.string().uuid(),
  deviceLabel: z.string().optional(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime().optional()
});

export type MobileSession = z.infer<typeof mobileSessionSchema>;
export type NewMobileSession = Omit<MobileSession, 'id' | 'revokedAt' | 'createdAt'>;
