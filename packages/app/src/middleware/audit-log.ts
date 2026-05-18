import type { Request, Response, NextFunction } from 'express';
import { AuditEventRepository } from '@rayhealth/core';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function entityTypeFromPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[0] === 'api' ? parts[1] ?? 'request' : parts[0] ?? 'request';
}

export function auditLog(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', async () => {
    const path = req.originalUrl || req.path;
    if (SAFE_METHODS.has(req.method) && !path.includes('/clients')) return;

    try {
      const entityType = entityTypeFromPath(path);
      await new AuditEventRepository(req.app.get('db')).create({
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: res.statusCode >= 400 ? 'permission.denied' : req.method === 'GET' ? 'phi.read' : 'request.write',
        entityType,
        entityId: req.auth.userId,
        outcome: res.statusCode >= 400 ? 'denied' : 'success',
        correlationId: req.header('x-request-id') ?? undefined,
        payload: {
          method: req.method,
          path,
          statusCode: res.statusCode,
          authMethod: req.auth.authMethod
        },
        occurredAt: new Date().toISOString()
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to persist audit event', error);
      }
    }
  });

  next();
}
