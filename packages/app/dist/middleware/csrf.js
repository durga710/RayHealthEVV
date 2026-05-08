import { hashOpaqueToken } from '../security/token-hashing.js';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export function requireCsrf(req, res, next) {
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
//# sourceMappingURL=csrf.js.map