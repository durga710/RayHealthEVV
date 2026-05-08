import { randomUUID } from 'node:crypto';
import { AuditEventRepository } from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const PATH_DENY = [/^\/?health$/i, /^\/?favicon\.ico$/i];
// PHI-bearing GET endpoints. Anything not in SAFE_METHODS is always logged.
const PHI_GET_PATHS = [
    /\/clients(?:\/|$)/,
    /\/evv(?:\/|$)/,
    /\/assignments(?:\/|$)/,
    /\/authorizations(?:\/|$)/,
    /\/templates(?:\/|$)/,
    /\/staff(?:\/|$)/,
    /\/maintenance(?:\/|$)/
];
function looksLikeUuid(segment) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
}
function extractResource(path) {
    const segments = path.split('?')[0].split('/').filter(Boolean);
    if (segments.length === 0)
        return { entityType: 'request' };
    const entityType = segments[0];
    const idSegment = segments.slice(1).find(looksLikeUuid);
    return { entityType, entityId: idSegment };
}
// Server-generated correlation id. Caller-provided x-request-id is IGNORED —
// trusting the client lets a malicious caller forge or collide audit ids.
function correlationFor(req, res) {
    const cached = req._serverCorrelationId;
    if (cached)
        return cached;
    const id = randomUUID();
    req._serverCorrelationId = id;
    res.setHeader('x-correlation-id', id);
    return id;
}
export function auditLog(req, res, next) {
    // Eagerly attach correlation id so even pre-auth failure paths are correlatable.
    correlationFor(req, res);
    res.on('finish', async () => {
        const path = req.originalUrl || req.path;
        if (PATH_DENY.some((re) => re.test(path)))
            return;
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
        if (!shouldLog)
            return;
        try {
            const { entityType, entityId } = extractResource(path);
            const failed = res.statusCode >= 400;
            // PHI lifecycle taxonomy:
            //   GET  → phi.read     (only fires for PHI_GET_PATHS — see filter above)
            //   POST → phi.create
            //   PUT/PATCH → phi.update
            //   DELETE → phi.delete
            //   anything else write-shaped → request.write (legacy fallback)
            const lifecycleByMethod = {
                GET: 'phi.read',
                POST: 'phi.create',
                PUT: 'phi.update',
                PATCH: 'phi.update',
                DELETE: 'phi.delete'
            };
            const eventType = failed
                ? 'permission.denied'
                : (lifecycleByMethod[req.method] ?? 'request.write');
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
                outcome: failed ? 'denied' : 'success',
                correlationId: correlationFor(req, res),
                payload: {
                    method: req.method,
                    path,
                    statusCode: res.statusCode,
                    authMethod: auth.authMethod
                },
                occurredAt: new Date().toISOString()
            });
        }
        catch (error) {
            safeError('Failed to persist audit event', error);
        }
    });
    next();
}
//# sourceMappingURL=audit-log.js.map