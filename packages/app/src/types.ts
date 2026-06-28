import type { AppRole } from '@rayhealth/core';

export interface AuthContext {
  agencyId: string;
  role: AppRole;
  userId: string;
  caregiverId?: string;
  authMethod: 'session' | 'bearer';
  sessionId?: string;
  csrfTokenHash?: string;
  // Bearer-only: the JWT's `jti` claim, looked up against mobile_sessions.
  tokenJti?: string;
}

/** Platform super-admin context — set only by requirePlatformAdmin. */
export interface PlatformAdminContext {
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      auth: AuthContext;
      platformAdmin?: PlatformAdminContext;
    }
  }
}
