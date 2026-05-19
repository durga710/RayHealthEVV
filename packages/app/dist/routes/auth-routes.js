import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { AgencyRepository, AuditEventRepository, SessionRepository, UserRepository } from '@rayhealth/core';
import { authContext } from '../middleware/auth-context.js';
import { requireCsrf } from '../middleware/csrf.js';
import { clearSessionCookieOptions, SESSION_COOKIE_NAME, sessionCookieOptions } from '../security/cookies.js';
import { createOpaqueToken, hashOpaqueToken } from '../security/token-hashing.js';
const router = Router();
function jwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET env var is not set');
    return secret;
}
async function recordAuditEvent(db, event) {
    try {
        await new AuditEventRepository(db).create(event);
    }
    catch (error) {
        if (process.env.NODE_ENV !== 'test') {
            console.error('Failed to persist auth audit event', error);
        }
    }
}
router.post('/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
        res.status(400).json({ message: 'email and password required' });
        return;
    }
    try {
        const db = req.app.get('db');
        const repo = new UserRepository(db);
        const user = await repo.findByEmail(email);
        if (!user) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }
        const sessionToken = createOpaqueToken();
        const csrfToken = createOpaqueToken();
        const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
        const session = await new SessionRepository(db).create({
            agencyId: user.agencyId,
            userId: user.id,
            role: user.role,
            caregiverId: user.caregiverId,
            sessionTokenHash: hashOpaqueToken(sessionToken),
            csrfTokenHash: hashOpaqueToken(csrfToken),
            userAgent: req.header('user-agent'),
            ipAddress: req.ip,
            expiresAt
        });
        await recordAuditEvent(db, {
            agencyId: user.agencyId,
            actorId: user.id,
            actorType: 'user',
            eventType: 'auth.login.success',
            entityType: 'session',
            entityId: session.id,
            outcome: 'success',
            payload: { authMethod: 'session' },
            occurredAt: new Date().toISOString()
        });
        const agencyTheme = await new AgencyRepository(db).findTheme(user.agencyId).catch(() => null);
        res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
        res.json({ userId: user.id, role: user.role, agencyId: user.agencyId, csrfToken, agencyTheme });
    }
    catch {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.post('/mobile/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
        res.status(400).json({ message: 'email and password required' });
        return;
    }
    try {
        const db = req.app.get('db');
        const user = await new UserRepository(db).findByEmail(email);
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }
        const token = jwt.sign({ sub: user.id, agencyId: user.agencyId, role: user.role, caregiverId: user.caregiverId }, jwtSecret(), { expiresIn: '8h', algorithm: 'HS256' });
        await recordAuditEvent(db, {
            agencyId: user.agencyId,
            actorId: user.id,
            actorType: 'user',
            eventType: 'auth.login.success',
            entityType: 'user',
            entityId: user.id,
            outcome: 'success',
            payload: { authMethod: 'bearer' },
            occurredAt: new Date().toISOString()
        });
        res.json({ token, role: user.role, agencyId: user.agencyId });
    }
    catch {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
const signupSchema = z.object({
    agencyName: z.string().min(2).max(200),
    state: z.literal('PA'),
    adminEmail: z.string().email().max(200),
    password: z.string().min(12).max(128),
});
// Self-serve agency signup. Creates agency + admin user atomically.
// Rate-limited at the mount level (same authLimiter as /login).
router.post('/signup', async (req, res) => {
    const parsed = signupSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid input' });
        return;
    }
    const { agencyName, state, adminEmail, password } = parsed.data;
    try {
        const db = req.app.get('db');
        const result = await db.transaction(async (trx) => {
            const existingUser = await new UserRepository(trx).findByEmail(adminEmail);
            if (existingUser) {
                const err = new Error('Email already registered');
                err.status = 409;
                throw err;
            }
            const agency = await new AgencyRepository(trx).createAgency({
                id: crypto.randomUUID(),
                name: agencyName,
                state,
                operatingTracks: ['personal-assistance'],
            });
            const passwordHash = await bcrypt.hash(password, 12);
            const user = await new UserRepository(trx).create({
                agencyId: agency.id,
                email: adminEmail,
                passwordHash,
                role: 'admin',
            });
            return { agency, user };
        });
        const sessionToken = createOpaqueToken();
        const csrfToken = createOpaqueToken();
        const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
        const session = await new SessionRepository(db).create({
            agencyId: result.user.agencyId,
            userId: result.user.id,
            role: result.user.role,
            caregiverId: undefined,
            sessionTokenHash: hashOpaqueToken(sessionToken),
            csrfTokenHash: hashOpaqueToken(csrfToken),
            userAgent: req.header('user-agent'),
            ipAddress: req.ip,
            expiresAt,
        });
        await recordAuditEvent(db, {
            agencyId: result.user.agencyId,
            actorId: result.user.id,
            actorType: 'user',
            eventType: 'auth.login.success',
            entityType: 'session',
            entityId: session.id,
            outcome: 'success',
            payload: { authMethod: 'session', source: 'signup' },
            occurredAt: new Date().toISOString(),
        });
        res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
        res.status(201).json({
            userId: result.user.id,
            role: result.user.role,
            agencyId: result.user.agencyId,
            csrfToken,
            agencyTheme: null,
        });
    }
    catch (err) {
        const status = err.status;
        if (status === 409) {
            res.status(409).json({ message: 'Email already registered' });
        }
        else {
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
});
// One-time admin bootstrap — serialized via advisory lock so concurrent requests cannot both succeed.
router.post('/bootstrap', async (req, res) => {
    const { agencyId, email, password } = req.body ?? {};
    if (!agencyId || !email || !password) {
        res.status(400).json({ message: 'agencyId, email and password required' });
        return;
    }
    if (password.length < 12) {
        res.status(400).json({ message: 'password must be at least 12 characters' });
        return;
    }
    try {
        const db = req.app.get('db');
        const repo = new UserRepository(db);
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await db.transaction(async (trx) => {
            // Advisory lock serializes all concurrent bootstrap attempts at the DB level.
            await trx.raw('SELECT pg_advisory_xact_lock(1073741823)');
            const [{ count }] = await trx('users').count('id as count');
            if (Number(count) > 0) {
                const err = new Error('Bootstrap already completed');
                err.status = 409;
                throw err;
            }
            return new UserRepository(trx).create({ agencyId, email, passwordHash, role: 'admin' });
        });
        const token = jwt.sign({ sub: user.id, agencyId: user.agencyId, role: user.role }, jwtSecret(), { expiresIn: '8h', algorithm: 'HS256' });
        res.status(201).json({ token, role: user.role, agencyId: user.agencyId });
    }
    catch (err) {
        const status = err.status;
        if (status === 409) {
            res.status(409).json({ message: 'Bootstrap already completed' });
        }
        else {
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
});
router.post('/logout', authContext, requireCsrf, async (req, res) => {
    try {
        if (req.auth.authMethod === 'session' && req.auth.sessionId) {
            await new SessionRepository(req.app.get('db')).revokeById(req.auth.sessionId, new Date().toISOString());
            await recordAuditEvent(req.app.get('db'), {
                agencyId: req.auth.agencyId,
                actorId: req.auth.userId,
                actorType: 'user',
                eventType: 'session.revoked',
                entityType: 'session',
                entityId: req.auth.sessionId,
                outcome: 'success',
                payload: { authMethod: req.auth.authMethod },
                occurredAt: new Date().toISOString()
            });
        }
        res.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions());
        res.status(204).send();
    }
    catch {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
// Protected — authContext applied directly so this route isn't bypassed by mount order.
router.get('/me', authContext, async (req, res) => {
    const { userId, role, agencyId } = req.auth;
    const db = req.app.get('db');
    const [agencyTheme, profileRow] = await Promise.all([
        new AgencyRepository(db).findTheme(agencyId).catch(() => null),
        (db('users').where({ id: userId }).select('email', 'first_name', 'last_name', 'avatar_url').first().catch(() => null)),
    ]);
    const profile = {
        email: profileRow?.email ?? null,
        firstName: profileRow?.first_name ?? null,
        lastName: profileRow?.last_name ?? null,
        avatarUrl: profileRow?.avatar_url ?? null,
    };
    if (req.auth.authMethod === 'session' && req.auth.sessionId) {
        const csrfToken = createOpaqueToken();
        await new SessionRepository(db).rotateCsrfToken(req.auth.sessionId, hashOpaqueToken(csrfToken));
        res.json({ userId, role, agencyId, csrfToken, agencyTheme, ...profile });
        return;
    }
    res.json({ userId, role, agencyId, agencyTheme, ...profile });
});
export default router;
//# sourceMappingURL=auth-routes.js.map