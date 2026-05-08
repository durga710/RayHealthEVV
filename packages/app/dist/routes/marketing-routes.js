import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { safeError } from '../security/safe-log.js';
const router = Router();
// Public, unauthenticated lead-capture endpoint. Mounted ABOVE authContext
// in app.ts so anonymous browsers can POST. Rate-limited at the app level.
// Stores into `contact_submissions` (NOT agency-scoped — interest data, not PHI).
router.post('/contact', async (req, res) => {
    const body = (req.body ?? {});
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const agency = typeof body.agency === 'string' ? body.agency.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!name || !email || !agency || !message) {
        res.status(400).json({ message: 'name, email, agency, and message are all required' });
        return;
    }
    if (name.length > 200 || email.length > 200 || agency.length > 200 || message.length > 4000) {
        res.status(400).json({ message: 'one or more fields exceed maximum length' });
        return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        res.status(400).json({ message: 'email is not a valid format' });
        return;
    }
    // Real client IP: prefer CF-Connecting-IP (Cloudflare in front of Vercel),
    // else trust-proxy-resolved req.ip.
    const cf = req.header('cf-connecting-ip');
    const ipAddress = ((cf && cf.trim()) || req.ip || '').toString().slice(0, 64) || null;
    const userAgent = (req.header('user-agent') ?? '').slice(0, 500) || null;
    try {
        const db = req.app.get('db');
        await db('contact_submissions').insert({
            id: randomUUID(),
            name,
            email,
            agency,
            message,
            ip_address: ipAddress,
            user_agent: userAgent
        });
        res.status(201).json({ ok: true });
    }
    catch (err) {
        safeError('contact_submissions insert failed', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
export default router;
//# sourceMappingURL=marketing-routes.js.map