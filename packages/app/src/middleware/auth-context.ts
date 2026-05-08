import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AppRole } from '@rayhealth/core';

interface JwtPayload {
  sub: string;
  agencyId: string;
  role: AppRole;
  caregiverId?: string;
}

export function authContext(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  // JWT_SECRET is validated at startup in createApp() — safe to assert here.
  const secret = process.env.JWT_SECRET!;

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.auth = {
      agencyId: payload.agencyId,
      role: payload.role,
      userId: payload.sub,
      caregiverId: payload.caregiverId
    };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
