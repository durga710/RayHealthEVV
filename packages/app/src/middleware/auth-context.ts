import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { MobileSessionRepository, SessionRepository, type AppRole } from '@rayhealth/core';
import { readCookie, SESSION_COOKIE_NAME } from '../security/cookies.js';
import { hashOpaqueToken } from '../security/token-hashing.js';

interface JwtPayload {
  sub: string;
  agencyId: string;
  role: AppRole;
  caregiverId?: string;
  /** Standard JWT id, matches a mobile_sessions row so the token is revocable. */
  jti?: string;
}

export async function authContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionToken = readCookie(req, SESSION_COOKIE_NAME);
  if (sessionToken) {
    try {
      const session = await new SessionRepository(req.app.get('db')).findActiveByTokenHash(
        hashOpaqueToken(sessionToken),
        new Date().toISOString()
      );
      if (session) {
        req.auth = {
          agencyId: session.agencyId,
          role: session.role,
          userId: session.userId,
          caregiverId: session.caregiverId,
          authMethod: 'session',
          sessionId: session.id,
          csrfTokenHash: session.csrfTokenHash
        };
        next();
        return;
      }
      res.status(401).json({ message: 'Invalid or expired session' });
      return;
    } catch {
      res.status(401).json({ message: 'Invalid or expired session' });
      return;
    }
  }

  const authHeader = req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  // JWT_SECRET is validated at startup in createApp(), safe to assert here.
  const secret = process.env.JWT_SECRET!;

  try {
    // Pin to HS256 explicitly. Without this, `jwt.verify` accepts whatever
    // algorithm the token declares, which enables the classic "alg=none"
    // bypass and the RS256-to-HS256 key-confusion attack.
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;

    // Mobile bearer tokens are revocable: every issued token carries a `jti`
    // backed by a mobile_sessions row. Reject any token without a jti, or whose
    // row is missing/revoked/expired, so logout and password-reset actually
    // terminate the session (a valid signature alone is not sufficient).
    if (!payload.jti) {
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }
    const mobileSession = await new MobileSessionRepository(req.app.get('db')).findActiveByJti(
      payload.jti,
      new Date().toISOString()
    );
    if (!mobileSession) {
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }

    req.auth = {
      agencyId: payload.agencyId,
      role: payload.role,
      userId: payload.sub,
      caregiverId: payload.caregiverId,
      authMethod: 'bearer',
      tokenJti: payload.jti
    };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
