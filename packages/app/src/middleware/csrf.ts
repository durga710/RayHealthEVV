import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { hashOpaqueToken } from '../security/token-hashing.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Constant-time equality for two hex digests. Fails closed if either is absent. */
function digestsEqual(a: string, b: string | undefined): boolean {
  if (!b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(Uint8Array.from(ab), Uint8Array.from(bb));
}

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method) || req.auth.authMethod !== 'session') {
    next();
    return;
  }

  const csrfToken = req.header('x-csrf-token');
  if (!csrfToken || !digestsEqual(hashOpaqueToken(csrfToken), req.auth.csrfTokenHash)) {
    res.status(403).json({ message: 'Invalid CSRF token' });
    return;
  }

  next();
}
