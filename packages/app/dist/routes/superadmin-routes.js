/**
 * Platform super-admin console (hidden; outside agency tenancy).
 *
 *   POST /superadmin/login                     — username + password → platform JWT
 *   GET  /superadmin/agencies                  — every agency + review status
 *   POST /superadmin/agencies/:id/approve      — approve a signup
 *   POST /superadmin/agencies/:id/reject       — reject (and lock out) a signup
 *   GET  /superadmin/users                     — every user across all agencies
 *   POST /superadmin/users/:id/suspend         — terminate (disable) an account
 *   POST /superadmin/users/:id/reactivate      — restore a suspended account
 *
 * Mounted BEFORE authContext: the super-admin authenticates with its own
 * bearer JWT (scope:'platform'), never an agency cookie/session. Credentials
 * come from env (SUPER_ADMIN_USERNAME + SUPER_ADMIN_PASSWORD_HASH, a bcrypt
 * hash) — the plaintext password is never stored in source or the DB. If those
 * env vars are unset the login endpoint returns 503 (feature disabled).
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { AuditEventRepository, PlatformAdminRepository, SUPER_ADMIN_ACTOR_ID, } from '@rayhealth/core';
import { requirePlatformAdmin } from '../middleware/require-platform-admin.js';
import { safeError } from '../security/safe-log.js';
const router = Router();
const loginSchema = z.object({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(200),
});
const reviewSchema = z.object({
    notes: z.string().max(2000).optional(),
});
// ---------- Login (no auth) ----------
router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        res.status(400).json({ message: 'username and password are required' });
        return;
    }
    const expectedUser = process.env.SUPER_ADMIN_USERNAME;
    const expectedHash = process.env.SUPER_ADMIN_PASSWORD_HASH;
    const secret = process.env.JWT_SECRET;
    if (!expectedUser || !expectedHash || !secret) {
        res.status(503).json({ message: 'Platform admin is not configured' });
        return;
    }
    const { username, password } = parsed.data;
    // Always run bcrypt.compare (even on username mismatch) to keep timing flat.
    const passwordOk = await bcrypt.compare(password, expectedHash);
    const userOk = username === expectedUser;
    if (!userOk || !passwordOk) {
        safeError('platform admin login failed', { username });
        res.status(401).json({ message: 'Invalid credentials' });
        return;
    }
    const token = jwt.sign({ sub: 'platform-superadmin', scope: 'platform', username }, secret, { expiresIn: '2h', algorithm: 'HS256' });
    res.json({ token, username });
});
// ---------- Everything below requires a platform token ----------
router.use(requirePlatformAdmin);
async function audit(db, eventType, agencyId, entityType, entityId, payload) {
    try {
        await new AuditEventRepository(db).create({
            agencyId,
            actorId: SUPER_ADMIN_ACTOR_ID,
            actorType: 'system',
            eventType,
            entityType,
            entityId,
            outcome: 'success',
            payload,
            occurredAt: new Date().toISOString(),
        });
    }
    catch (err) {
        safeError(`Failed to audit ${eventType}`, err);
    }
}
router.get('/agencies', async (req, res) => {
    try {
        const agencies = await new PlatformAdminRepository(req.app.get('db')).listAgencies();
        res.json(agencies);
    }
    catch (err) {
        safeError('superadmin list agencies failed', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
async function reviewAgency(req, res, status) {
    const parsed = reviewSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        res.status(400).json({ message: 'notes must be a string under 2000 chars' });
        return;
    }
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const reviewer = req.platformAdmin?.username ?? 'superadmin';
    try {
        const db = req.app.get('db');
        const repo = new PlatformAdminRepository(db);
        const updated = await repo.setAgencyReview(id, status, reviewer, parsed.data.notes ?? null);
        if (!updated) {
            res.status(404).json({ message: 'agency not found' });
            return;
        }
        // Rejecting an agency that was previously approved must lock its users out
        // immediately — revoke their active sessions.
        if (status === 'rejected') {
            await db('sessions').where({ agency_id: id }).whereNull('revoked_at').update({ revoked_at: db.fn.now() });
        }
        await audit(db, status === 'approved' ? 'agency.review.approved' : 'agency.review.rejected', id, 'agency', id, { agencyName: updated.name, reviewer, notes: parsed.data.notes ?? null });
        res.json({ id, reviewStatus: status });
    }
    catch (err) {
        safeError('superadmin review agency failed', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}
router.post('/agencies/:id/approve', (req, res) => reviewAgency(req, res, 'approved'));
router.post('/agencies/:id/reject', (req, res) => reviewAgency(req, res, 'rejected'));
router.get('/users', async (req, res) => {
    try {
        const users = await new PlatformAdminRepository(req.app.get('db')).listUsers();
        res.json(users);
    }
    catch (err) {
        safeError('superadmin list users failed', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
async function setSuspended(req, res, suspended) {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    try {
        const db = req.app.get('db');
        const result = await new PlatformAdminRepository(db).setUserSuspended(id, suspended);
        if (!result) {
            res.status(404).json({ message: 'user not found' });
            return;
        }
        await audit(db, suspended ? 'account.suspended' : 'account.reactivated', result.agencyId, 'user', id, { email: result.email, by: req.platformAdmin?.username ?? 'superadmin' });
        res.json({ id, suspended });
    }
    catch (err) {
        safeError('superadmin set-suspended failed', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}
router.post('/users/:id/suspend', (req, res) => setSuspended(req, res, true));
router.post('/users/:id/reactivate', (req, res) => setSuspended(req, res, false));
export default router;
//# sourceMappingURL=superadmin-routes.js.map