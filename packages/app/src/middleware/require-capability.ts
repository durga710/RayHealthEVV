import type { Request, Response, NextFunction } from 'express';
import { hasCapability, type Capability } from '@rayhealth/core';

export function requireCapability(capability: Capability) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth || !hasCapability(req.auth.role, capability)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    next();
  };
}
