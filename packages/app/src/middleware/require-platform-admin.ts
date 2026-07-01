import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PLATFORM_COOKIE_NAME, readCookie } from '../security/cookies.js';

/**
 * Gate for the platform super-admin. The super-admin authenticates OUTSIDE the
 * agency tenancy with a JWT carrying `scope:'platform'` (issued by the WebAuthn
 * verify endpoints).
 *
 * The token is delivered primarily in an httpOnly `rayhealth_platform` cookie so
 * it never lives in JS-readable storage (XSS cannot exfiltrate the highest-
 * privilege credential in the system). SameSite=strict on that cookie is the
 * CSRF defense. A Bearer Authorization header is still accepted as a fallback
 * for API/test clients — this does not reintroduce the XSS-exfiltration risk
 * because no platform token is exposed to JS for a script to steal.
 */

interface PlatformJwtPayload {
  sub: string;
  scope: string;
  username: string;
}

function extractToken(req: Request): string | undefined {
  const cookieToken = readCookie(req, PLATFORM_COOKIE_NAME);
  if (cookieToken) return cookieToken;
  const header = req.header('Authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return undefined;
}

export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ message: 'Platform authorization required' });
    return;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ message: 'Server auth not configured' });
    return;
  }
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as PlatformJwtPayload;
    if (payload.scope !== 'platform') {
      res.status(403).json({ message: 'Not a platform token' });
      return;
    }
    req.platformAdmin = { username: payload.username };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired platform token' });
  }
}
