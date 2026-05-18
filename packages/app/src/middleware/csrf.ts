import type { Request, Response, NextFunction } from 'express';
import { hashOpaqueToken } from '../security/token-hashing.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method) || req.auth.authMethod !== 'session') {
    next();
    return;
  }

  const csrfToken = req.header('x-csrf-token');
  if (!csrfToken || hashOpaqueToken(csrfToken) !== req.auth.csrfTokenHash) {
    res.status(403).json({ message: 'Invalid CSRF token' });
    return;
  }

  next();
}
