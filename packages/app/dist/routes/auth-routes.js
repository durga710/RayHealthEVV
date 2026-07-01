import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { AgencyRepository, AuditEventRepository, CaregiverRepository, PasswordResetRepository, SessionRepository, UserRepository } from '@rayhealth/core';
import { authContext } from '../middleware/auth-context.js';
import { requireCsrf } from '../middleware/csrf.js';
import { clearSessionCookieOptions, SESSION_COOKIE_NAME, sessionCookieOptions } from '../security/cookies.js';
import { createOpaqueToken, hashOpaqueToken } from '../security/token-hashing.js';
import { createEmailClient, buildPasswordResetUrl } from '../email/email-client.js';
import { safeError } from '../security/safe-log.js';
import { CURRENT_TERMS_VERSION } from '../terms.js';
import { verifySync } from 'otplib';
const router = Router();
/**
 * A valid cost-12 bcrypt hash (of a throwaway string, NOT a real credential)
 * used only to equalize response timing on the "user not found" path so an
 * attacker cannot enumerate registered emails by measuring how long a login
 * takes. Its cost factor matches the real hashes produced by bcrypt.hash(_, 12).
 */
const DUMMY_PASSWORD_HASH = '$2b$12$df0z.PFd7acWE5orxTvFmOnjqLdyh92rNGAOmR5RicwgyE18g7Vsm';
function jwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET env var is not set');
    return secret;
}
/**
 * Login gate enforced after the password check: a suspended account or an
 * agency that the platform super-admin hasn't approved cannot sign in. The
 * fields come from UserRepository.findByEmail (R21+); when they're undefined
 * (older data / mocked tests) the login is not gated.
 */
function loginGate(user) {
    if (user.suspendedAt) {
        return { code: 'ACCOUNT_SUSPENDED', message: 'This account has been suspended. Contact your administrator.' };
    }
    if (user.agencyReviewStatus === 'pending') {
        return {
            code: 'AGENCY_PENDING_REVIEW',
            message: 'Your agency is awaiting review and approval. You will be able to sign in once approved.',
        };
    }
    if (user.agencyReviewStatus === 'rejected') {
        return { code: 'AGENCY_REJECTED', message: 'Your agency registration was not approved. Contact support.' };
    }
    return null;
}
async function recordAuditEvent(db, event) {
    try {
        await new AuditEventRepository(db).create(event);
    }
    catch (error) {
        // safeError redacts PHI/PII that Postgres driver errors can embed in
        // .message/.stack, keeping it out of the (non-BAA) deploy log pipeline.
        if (process.env.NODE_ENV !== 'test') {
            safeError('Failed to persist auth audit event', error);
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
            // Run a bcrypt.compare against a dummy cost-12 hash even when the account
            // doesn't exist, so response timing doesn't reveal which emails are
            // registered (account enumeration). Matches the flat-timing pattern in
            // superadmin-routes.
            await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }
        const gate = loginGate(user);
        if (gate) {
            res.status(403).json({ code: gate.code, message: gate.message });
            return;
        }
        // If the user has TOTP 2FA enabled, do not establish a session yet — issue a
        // short-lived challenge token and require a second factor via /login/2fa.
        // `totpEnabled` rides along on findByEmail, so no second query is needed.
        if (user.totpEnabled) {
            const challengeToken = jwt.sign({ sub: user.id, purpose: '2fa' }, jwtSecret(), { expiresIn: '5m' });
            res.json({ twoFactorRequired: true, challengeToken });
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
        const [agencyTheme, profileRow] = await Promise.all([
            new AgencyRepository(db).findTheme(user.agencyId).catch(() => null),
            (db('users').where({ id: user.id }).select('email', 'first_name', 'last_name', 'avatar_url').first().catch(() => null)),
        ]);
        const profile = {
            email: profileRow?.email ?? user.email ?? null,
            firstName: profileRow?.first_name ?? null,
            lastName: profileRow?.last_name ?? null,
            avatarUrl: profileRow?.avatar_url ?? null,
        };
        res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
        res.json({ userId: user.id, role: user.role, agencyId: user.agencyId, csrfToken, agencyTheme, ...profile });
    }
    catch {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
// Second factor: exchange a challenge token + TOTP/backup code for a session.
router.post('/login/2fa', async (req, res) => {
    const { challengeToken, code } = req.body ?? {};
    if (!challengeToken || !code) {
        res.status(400).json({ message: 'challengeToken and code are required' });
        return;
    }
    try {
        let userId;
        try {
            const payload = jwt.verify(challengeToken, jwtSecret(), { algorithms: ['HS256'] });
            if (payload.purpose !== '2fa' || !payload.sub)
                throw new Error('bad challenge');
            userId = payload.sub;
        }
        catch {
            res.status(401).json({ message: 'Your verification session expired. Please sign in again.' });
            return;
        }
        const db = req.app.get('db');
        const row = (await db('users').where({ id: userId }).first());
        if (!row || !row.totp_enabled || !row.totp_secret) {
            res.status(401).json({ message: 'Two-factor authentication is not available for this account.' });
            return;
        }
        const cleaned = String(code).replace(/\s/g, '');
        let verified = verifySync({ token: cleaned, secret: row.totp_secret }).valid;
        // Fall back to single-use backup codes.
        if (!verified && Array.isArray(row.totp_backup_codes)) {
            const upper = cleaned.toUpperCase();
            for (let i = 0; i < row.totp_backup_codes.length; i += 1) {
                if (await bcrypt.compare(upper, row.totp_backup_codes[i])) {
                    verified = true;
                    const remaining = row.totp_backup_codes.filter((_, j) => j !== i);
                    await db('users').where({ id: row.id }).update({ totp_backup_codes: JSON.stringify(remaining) });
                    break;
                }
            }
        }
        if (!verified) {
            res.status(401).json({ message: 'That code is incorrect or expired.' });
            return;
        }
        const sessionToken = createOpaqueToken();
        const csrfToken = createOpaqueToken();
        const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
        const session = await new SessionRepository(db).create({
            agencyId: row.agency_id,
            userId: row.id,
            role: row.role,
            caregiverId: row.caregiver_id ?? undefined,
            sessionTokenHash: hashOpaqueToken(sessionToken),
            csrfTokenHash: hashOpaqueToken(csrfToken),
            userAgent: req.header('user-agent'),
            ipAddress: req.ip,
            expiresAt,
        });
        await recordAuditEvent(db, {
            agencyId: row.agency_id,
            actorId: row.id,
            actorType: 'user',
            eventType: 'auth.login.success',
            entityType: 'session',
            entityId: session.id,
            outcome: 'success',
            payload: { authMethod: 'session', secondFactor: 'totp' },
            occurredAt: new Date().toISOString(),
        });
        const agencyTheme = await new AgencyRepository(db).findTheme(row.agency_id).catch(() => null);
        res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
        res.json({
            userId: row.id,
            role: row.role,
            agencyId: row.agency_id,
            csrfToken,
            agencyTheme,
            email: row.email,
            firstName: row.first_name,
            lastName: row.last_name,
            avatarUrl: row.avatar_url,
        });
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
        // Always run bcrypt.compare (dummy hash when the account is missing) so
        // timing doesn't reveal whether the email is registered.
        const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
        if (!user || !passwordOk) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }
        const gate = loginGate(user);
        if (gate) {
            res.status(403).json({ code: gate.code, message: gate.message });
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
    // Affirmative Terms of Service acceptance is required to create an account.
    acceptedTerms: z.literal(true, { message: 'You must accept the Terms of Service to continue' }),
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
            const userRepo = new UserRepository(trx);
            const user = await userRepo.create({
                agencyId: agency.id,
                email: adminEmail,
                passwordHash,
                role: 'admin',
            });
            await userRepo.recordTermsAcceptance(user.id, CURRENT_TERMS_VERSION);
            return { agency, user };
        });
        // A self-serve signup creates the agency in `review_status='pending'`. We do
        // NOT establish a session here — the agency must be approved by a platform
        // super-admin before anyone on it can sign in. Issuing a cookie at this point
        // would let an unapproved tenant operate the system, bypassing the review gate.
        await recordAuditEvent(db, {
            agencyId: result.user.agencyId,
            actorId: result.user.id,
            actorType: 'user',
            eventType: 'agency.review.requested',
            entityType: 'agency',
            entityId: result.user.agencyId,
            outcome: 'success',
            payload: { source: 'signup' },
            occurredAt: new Date().toISOString(),
        });
        res.status(201).json({
            status: 'pending_review',
            message: 'Your agency has been registered and is awaiting review. You will be able to sign in once approved.',
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
    // Secret gate (documented in .env.example): the endpoint is DISABLED unless
    // BOOTSTRAP_SECRET is set, and requires a matching bootstrapSecret in the
    // body. This is the documented way to disable bootstrap in prod after the
    // first admin exists, and a second line of defense beyond the empty-users
    // check below (e.g. if the users table is ever emptied by a migration/restore).
    const expectedSecret = process.env.BOOTSTRAP_SECRET;
    if (!expectedSecret) {
        res.status(503).json({ message: 'Bootstrap is disabled' });
        return;
    }
    const providedSecret = typeof req.body?.bootstrapSecret === 'string' ? req.body.bootstrapSecret : '';
    const expectedBuf = Uint8Array.from(Buffer.from(expectedSecret));
    const providedBuf = Uint8Array.from(Buffer.from(providedSecret));
    if (expectedBuf.length !== providedBuf.length ||
        !timingSafeEqual(expectedBuf, providedBuf)) {
        res.status(403).json({ message: 'Forbidden' });
        return;
    }
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
const forgotPasswordSchema = z.object({
    email: z.string().email().max(200),
});
const resetPasswordSchema = z.object({
    token: z.string().min(1).max(128),
    password: z.string().min(12).max(128),
});
// POST /auth/forgot-password
// Always returns 200 so we don't reveal whether an email exists.
router.post('/forgot-password', async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        res.status(400).json({ message: 'Valid email required' });
        return;
    }
    const { email } = parsed.data;
    try {
        const db = req.app.get('db');
        const user = await new UserRepository(db).findByEmail(email);
        if (user) {
            const rawToken = createOpaqueToken(32);
            const tokenHash = hashOpaqueToken(rawToken);
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
            await new PasswordResetRepository(db).create(user.id, tokenHash, expiresAt);
            const resetUrl = buildPasswordResetUrl(rawToken);
            const emailClient = createEmailClient();
            const result = await emailClient.sendPasswordResetEmail({ to: email, resetUrl });
            await recordAuditEvent(db, {
                agencyId: user.agencyId,
                actorId: user.id,
                actorType: 'user',
                eventType: 'auth.password_reset.requested',
                entityType: 'user',
                entityId: user.id,
                outcome: result.ok ? 'success' : 'failure',
                payload: { emailDelivery: result.ok ? 'sent' : result.error },
                occurredAt: new Date().toISOString(),
            });
        }
        // Always 200 — never disclose whether the email is registered
        res.json({ message: 'If that email is registered, a reset link has been sent.' });
    }
    catch (err) {
        safeError('POST /auth/forgot-password failed', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
// POST /auth/reset-password
router.post('/reset-password', async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid input' });
        return;
    }
    const { token, password } = parsed.data;
    try {
        const db = req.app.get('db');
        const tokenHash = hashOpaqueToken(token);
        const resetRepo = new PasswordResetRepository(db);
        const resetToken = await resetRepo.findValid(tokenHash);
        if (!resetToken) {
            res.status(400).json({ message: 'This reset link is invalid or has expired.' });
            return;
        }
        const passwordHash = await bcrypt.hash(password, 12);
        await db.transaction(async (trx) => {
            await trx('users').where('id', resetToken.userId).update({ password_hash: passwordHash });
            await resetRepo.markUsed(resetToken.id);
            // Revoke all active sessions for security
            await trx('sessions').where('user_id', resetToken.userId).whereNull('revoked_at').update({
                revoked_at: new Date().toISOString(),
            });
        });
        const user = await new UserRepository(db).findById(resetToken.userId);
        if (user) {
            await recordAuditEvent(db, {
                agencyId: user.agencyId,
                actorId: user.id,
                actorType: 'user',
                eventType: 'auth.password_reset.completed',
                entityType: 'user',
                entityId: user.id,
                outcome: 'success',
                payload: {},
                occurredAt: new Date().toISOString(),
            });
        }
        res.json({ message: 'Password updated. You can now sign in with your new password.' });
    }
    catch (err) {
        safeError('POST /auth/reset-password failed', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
// Protected — authContext applied directly so this route isn't bypassed by mount order.
async function sendAuthProfile(req, res) {
    const { userId, role, agencyId, caregiverId } = req.auth;
    const db = req.app.get('db');
    const [agencyTheme, user, caregiver] = await Promise.all([
        new AgencyRepository(db).findTheme(agencyId).catch(() => null),
        new UserRepository(db).findById(userId),
        caregiverId ? new CaregiverRepository(db).findById(caregiverId, agencyId) : Promise.resolve(null),
    ]);
    const profile = {
        email: user?.email ?? null,
        firstName: caregiver?.firstName ?? null,
        lastName: caregiver?.lastName ?? null,
        avatarUrl: null,
    };
    if (req.auth.authMethod === 'session' && req.auth.sessionId) {
        const csrfToken = createOpaqueToken();
        await new SessionRepository(db).rotateCsrfToken(req.auth.sessionId, hashOpaqueToken(csrfToken));
        res.json({ userId, role, agencyId, csrfToken, agencyTheme, ...profile });
        return;
    }
    res.json({ userId, role, agencyId, agencyTheme, ...profile });
}
router.get('/me', authContext, async (req, res) => sendAuthProfile(req, res));
router.get('/mobile/me', authContext, async (req, res) => sendAuthProfile(req, res));
export default router;
//# sourceMappingURL=auth-routes.js.map