import jwt from 'jsonwebtoken';
import { PLATFORM_COOKIE_NAME, readCookie } from '../security/cookies.js';
function extractToken(req) {
    const cookieToken = readCookie(req, PLATFORM_COOKIE_NAME);
    if (cookieToken)
        return cookieToken;
    const header = req.header('Authorization');
    if (header?.startsWith('Bearer '))
        return header.slice(7);
    return undefined;
}
export function requirePlatformAdmin(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        res.status(401).json({ message: 'Platform authorization required' });
        return;
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        res.status(500).json({ message: 'Server auth not configured' });
        return;
    }
    try {
        const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
        if (payload.scope !== 'platform') {
            res.status(403).json({ message: 'Not a platform token' });
            return;
        }
        req.platformAdmin = { username: payload.username };
        next();
    }
    catch {
        res.status(401).json({ message: 'Invalid or expired platform token' });
    }
}
//# sourceMappingURL=require-platform-admin.js.map