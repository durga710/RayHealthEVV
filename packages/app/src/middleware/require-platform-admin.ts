import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Gate for the platform super-admin. The super-admin authenticates OUTSIDE the
 * agency tenancy: a bearer JWT signed with JWT_SECRET carrying `scope:'platform'`
 * (issued by POST /superadmin/login). This is deliberately separate from the
 * agency cookie/session machinery — no agency context, no CSRF — so the hidden
 * console can't be reached with an ordinary agency token, and an agency token
 * can't be used here.
 */

interface PlatformJwtPayload {
  sub: string;
  scope: string;
  username: string;
}

export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Platform authorization required' });
    return;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ message: 'Server auth not configured' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), secret, { algorithms: ['HS256'] }) as PlatformJwtPayload;
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
