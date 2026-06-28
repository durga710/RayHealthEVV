import jwt from 'jsonwebtoken';
export function requirePlatformAdmin(req, res, next) {
    const header = req.header('Authorization');
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Platform authorization required' });
        return;
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        res.status(500).json({ message: 'Server auth not configured' });
        return;
    }
    try {
        const payload = jwt.verify(header.slice(7), secret, { algorithms: ['HS256'] });
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