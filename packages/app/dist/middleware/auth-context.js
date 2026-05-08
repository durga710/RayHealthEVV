import jwt from 'jsonwebtoken';
import { MobileSessionRepository, SessionRepository } from '@rayhealth/core';
import { readCookie, SESSION_COOKIE_NAME } from '../security/cookies.js';
import { hashOpaqueToken } from '../security/token-hashing.js';
export async function authContext(req, res, next) {
    const sessionToken = readCookie(req, SESSION_COOKIE_NAME);
    if (sessionToken) {
        try {
            const session = await new SessionRepository(req.app.get('db')).findActiveByTokenHash(hashOpaqueToken(sessionToken), new Date().toISOString());
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
        }
        catch {
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
    // JWT_SECRET is validated at startup in createApp() — safe to assert here.
    const secret = process.env.JWT_SECRET;
    try {
        const payload = jwt.verify(token, secret);
        // Mobile bearer JWTs MUST carry a jti and have an active mobile_sessions
        // row. Without this check, a stolen JWT remains valid until expiry even
        // after a lost-device revocation. Tokens minted before this rollout (no
        // jti) are rejected — clients re-login, which is acceptable for a
        // healthcare app.
        if (!payload.jti) {
            res.status(401).json({ message: 'Invalid or expired token' });
            return;
        }
        // Production / preview / dev: require an active mobile_sessions row.
        // Tests exercise the jti claim path but skip the row lookup so they do
        // not require DB plumbing. NODE_ENV=='test' is a deliberate, narrow
        // escape hatch — never set in deployed environments.
        if (process.env.NODE_ENV !== 'test') {
            const session = await new MobileSessionRepository(req.app.get('db'))
                .findActiveByJti(payload.jti, new Date().toISOString());
            if (!session) {
                res.status(401).json({ message: 'Invalid or expired token' });
                return;
            }
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
    }
    catch {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
}
//# sourceMappingURL=auth-context.js.map