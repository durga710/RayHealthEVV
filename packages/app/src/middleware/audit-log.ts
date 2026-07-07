import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { AuditEventRepository } from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';

/**
 * Local alias of the AuditEventType domain enum. The full union lives in
 * `@rayhealth/core/src/domain/audit.ts`; we redeclare a narrow subset here
 * to keep this middleware's dispatch table self-documenting and to keep the
 * type narrow without dragging in the full Zod schema.
 */
type AuditEventTypeLite =
  | 'phi.read'
  | 'phi.create'
  | 'phi.update'
  | 'phi.delete'
  | 'phi.export'
  | 'request.write'
  | 'permission.denied';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const PATH_DENY = [
  /^\/?health$/i,
  /^\/?favicon\.ico$/i,
  /^\/?marketing(\/|$)/i, // public lead capture; not agency-scoped, no req.auth
  /^\/?support(\/|$)/i // public support chat; not agency-scoped, no req.auth
];

// PHI-bearing GET endpoints. Anything not in SAFE_METHODS is always logged.
const PHI_GET_PATHS = [
  /\/clients(?:\/|$)/,
  /\/evv(?:\/|$)/,
  /\/assignments(?:\/|$)/,
  /\/authorizations(?:\/|$)/,
  /\/templates(?:\/|$)/,
  /\/staff(?:\/|$)/,
  /\/maintenance(?:\/|$)/,
  /\/exports(?:\/|$)/, // CSV downloads. Cures-Act submission rows + PHI
  // Caregiver mobile schedule reads, client names, home address, and home
  // GPS coordinates. Read by every caregiver every shift; the highest-volume
  // PHI read in the product. The `[/?]|$` boundary also matches a trailing
  // query string (e.g. /mobile/caregiver/schedule?days=7).
  /\/mobile\/caregiver(?:[/?]|$)/,
  // Admin Command Center visit board, client names. Its /command-center
  // /summary sibling is count-only and is deliberately NOT listed here.
  /\/command-center\/today(?:[/?]|$)/,
  // Compliance Engine open-exceptions list, client + caregiver names. Its
  // /exceptions/resolution sibling is count-only and is excluded.
  /\/exceptions\/list(?:[/?]|$)/,
  // Billing claims. Medicaid member ids and client identifiers exposed on the
  // claim detail and 837 generation reads.
  /\/claims(?:[/?]|$)/
];

// Paths that should record `phi.export` (bulk PHI extraction) rather than
// the default phi.read. Aggregator submissions are a distinct audit category
// for HIPAA disclosure logs.
const PHI_EXPORT_PATHS = [/\/exports(?:\/|$)/];

function looksLikeUuid(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
}

function extractResource(path: string): { entityType: string; entityId?: string } {
  const segments = path.split('?')[0].split('/').filter(Boolean);
  if (segments.length === 0) return { entityType: 'request' };
  const entityType = segments[0];
  const idSegment = segments.slice(1).find(looksLikeUuid);
  return { entityType, entityId: idSegment };
}

// Server-generated correlation id. Caller-provided x-request-id is IGNORED , 
// trusting the client lets a malicious caller forge or collide audit ids.
function correlationFor(req: Request, res: Response): string {
  const cached = (req as unknown as { _serverCorrelationId?: string })._serverCorrelationId;
  if (cached) return cached;
  const id = randomUUID();
  (req as unknown as { _serverCorrelationId: string })._serverCorrelationId = id;
  res.setHeader('x-correlation-id', id);
  return id;
}

export function auditLog(req: Request, res: Response, next: NextFunction): void {
  // Eagerly attach correlation id so even pre-auth failure paths are correlatable.
  correlationFor(req, res);

  res.on('finish', async () => {
    const path = req.originalUrl || req.path;
    if (PATH_DENY.some((re) => re.test(path))) return;

    // CRITICAL: req.auth is undefined whenever auth fails (401, malformed token,
    // bootstrap deny, etc.). Dereferencing was crashing the finish handler.
    const auth = req.auth;
    if (!auth) {
      // Without an agency_id we can't satisfy NOT NULL on audit_events.agency_id.
      // /auth/* paths are rate-limited and observable from access logs.
      return;
    }

    const isPhiGet = req.method === 'GET' && PHI_GET_PATHS.some((re) => re.test(path));
    const shouldLog = !SAFE_METHODS.has(req.method) || isPhiGet;
    if (!shouldLog) return;

    try {
      const { entityType, entityId } = extractResource(path);
      const status = res.statusCode;
      // Only a genuine authorization failure (401 unauthenticated / 403
      // forbidden) is `permission.denied`. Every other failure, 404 not
      // found, 422 validation, 5xx, is the SAME lifecycle action that
      // happened to fail, recorded with its lifecycle event type and
      // outcome=failure. Tagging a 404/500 as `permission.denied` would
      // pollute the immutable trail's forensic taxonomy (an access denial
      // that never occurred).
      const isAuthzDenial = status === 401 || status === 403;
      const failed = status >= 400;
      // PHI lifecycle taxonomy:
      //   GET  → phi.read     (only fires for PHI_GET_PATHS, see filter above)
      //   POST → phi.create
      //   PUT/PATCH → phi.update
      //   DELETE → phi.delete
      //   anything else write-shaped → request.write (legacy fallback)
      const lifecycleByMethod: Record<string, AuditEventTypeLite> = {
        GET: 'phi.read',
        POST: 'phi.create',
        PUT: 'phi.update',
        PATCH: 'phi.update',
        DELETE: 'phi.delete'
      };
      const isExport = PHI_EXPORT_PATHS.some((re) => re.test(path));
      const lifecycleType: AuditEventTypeLite = isExport
        ? 'phi.export'
        : (lifecycleByMethod[req.method] ?? 'request.write');
      const eventType: AuditEventTypeLite = isAuthzDenial ? 'permission.denied' : lifecycleType;
      await new AuditEventRepository(req.app.get('db')).create({
        agencyId: auth.agencyId,
        actorId: auth.userId,
        actorType: 'user',
        eventType,
        entityType,
        // Resource id when present; fall back to actor only if the path has no
        // resource UUID (e.g. POST /clients creating a record). HIPAA 164.312(b)
        // requires identifying WHAT was touched.
        entityId: entityId ?? auth.userId,
        outcome: isAuthzDenial ? 'denied' : failed ? 'failure' : 'success',
        correlationId: correlationFor(req, res),
        payload: {
          method: req.method,
          path,
          statusCode: res.statusCode,
          authMethod: auth.authMethod
        },
        occurredAt: new Date().toISOString()
      });
    } catch (error) {
      safeError('Failed to persist audit event', error);
    }
  });

  next();
}
