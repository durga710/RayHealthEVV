import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { AuditEventRepository, CaregiverRepository, UserAgencyRepository, UserRepository } from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';
const router = Router();
const VALID_ROLES = new Set(['admin', 'coordinator', 'caregiver', 'family']);
const MIN_PASSWORD_LEN = 12;
const TOKEN_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function audit(db, event) {
    try {
        await new AuditEventRepository(db).create(event);
    }
    catch (err) {
        safeError('failed to persist invitations audit event', err);
    }
}
/**
 * GET /invitations/:token — public, no auth.
 *
 * Looks up an invite by its UUID share-token. Returns a small
 * `{isValid, status, ...}` envelope so the accept-screen UI can either
 * show "you're joining <Agency>" or a friendly "invalid or expired"
 * message — without ever leaking whether the underlying token was
 * once-real-but-now-redeemed vs never-issued. Both cases return
 * `isValid: false`; the `status` field is purely informational for the
 * UI and is the same string the row had at lookup time.
 */
router.get('/:token', async (req, res) => {
    const token = req.params.token;
    if (typeof token !== 'string' || !TOKEN_UUID_RE.test(token)) {
        res.status(400).json({ isValid: false, status: 'invalid' });
        return;
    }
    try {
        const db = req.app.get('db');
        const invite = await new CaregiverRepository(db).findInviteById(token);
        if (!invite) {
            res.status(404).json({ isValid: false, status: 'not_found' });
            return;
        }
        const expired = new Date(invite.expiresAt).getTime() < Date.now();
        const accepted = invite.acceptedAt !== null;
        const isValid = !expired && !accepted && invite.status === 'pending';
        res.json({
            token: invite.id,
            email: invite.email,
            role: invite.role,
            agencyId: invite.agencyId,
            agencyName: invite.agencyName,
            expiresAt: invite.expiresAt,
            status: accepted ? 'accepted' : expired ? 'expired' : invite.status,
            isValid
        });
    }
    catch (err) {
        safeError('GET /invitations/:token failed', err);
        res.status(500).json({ isValid: false, status: 'error' });
    }
});
/**
 * POST /invitations/accept — public, no auth.
 *
 * Single-use token redemption. Validates the invite, creates a
 * `caregivers` row (if role=caregiver) and a `users` row in one
 * transaction, marks the invite accepted, and emits an
 * `invite.accepted` audit row. Caller can then sign in via
 * `/auth/login` (web cookie) or `/auth/mobile/login` (bearer JWT).
 *
 * Note: we do NOT auto-issue a session at accept time. Forcing the
 * caller to log in once after accepting catches "I just accepted but
 * forgot my password" cases right away, on a fresh path through
 * recordLoginFailure audit instead of the accept path.
 */
router.post('/accept', async (req, res) => {
    const body = (req.body ?? {});
    const token = typeof body.token === 'string' ? body.token : '';
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : undefined;
    if (!TOKEN_UUID_RE.test(token)) {
        res.status(400).json({ message: 'invalid token format' });
        return;
    }
    if (!firstName || !lastName) {
        res.status(400).json({ message: 'firstName and lastName are required' });
        return;
    }
    if (password.length < MIN_PASSWORD_LEN) {
        res.status(400).json({ message: `password must be at least ${MIN_PASSWORD_LEN} characters` });
        return;
    }
    try {
        const db = req.app.get('db');
        const passwordHash = await bcrypt.hash(password, 12);
        const acceptedAt = new Date().toISOString();
        const result = await db.transaction(async (trx) => {
            const inviteRepo = new CaregiverRepository(trx);
            const invite = await inviteRepo.findInviteById(token);
            if (!invite) {
                const err = new Error('invitation not found');
                err.status = 404;
                throw err;
            }
            if (invite.acceptedAt !== null || invite.status !== 'pending') {
                const err = new Error('invitation already used');
                err.status = 409;
                throw err;
            }
            if (new Date(invite.expiresAt).getTime() < Date.now()) {
                const err = new Error('invitation expired');
                err.status = 410;
                throw err;
            }
            if (!VALID_ROLES.has(invite.role)) {
                const err = new Error('invitation has unknown role');
                err.status = 422;
                throw err;
            }
            // staffInviteSchema marks id as optional for the insert shape;
            // a row resolved by findInviteById always has it.
            const inviteId = invite.id ?? token;
            // user_agencies is the multi-agency membership table; on a database
            // that predates its migration, only the single-agency path works.
            let hasMemberships = false;
            try {
                hasMemberships = await trx.schema.hasTable('user_agencies');
            }
            catch {
                /* schema introspection unavailable — behave as pre-migration */
            }
            // A user may already exist under this email at ANOTHER agency — a
            // caregiver can work for multiple agencies with one mobile identity.
            // In that case this accept links the inviting agency to the existing
            // account instead of creating a new one. The person accepting must
            // prove they own that account by entering its current password.
            // Privacy: nothing in this flow reveals to the inviting agency (or the
            // caregiver) WHICH other agencies the account is linked to.
            const existing = await new UserRepository(trx).findByEmail(invite.email);
            if (existing) {
                if (!hasMemberships || invite.role !== 'caregiver' || existing.role !== 'caregiver') {
                    const err = new Error('An account with this email already exists.');
                    err.status = 409;
                    throw err;
                }
                const passwordOk = await bcrypt.compare(password, existing.passwordHash);
                if (!passwordOk) {
                    const err = new Error('An account with this email already exists. Enter that account’s current password to link this agency to it.');
                    err.status = 409;
                    err.code = 'EXISTING_ACCOUNT_PASSWORD_REQUIRED';
                    throw err;
                }
                const membershipRepo = new UserAgencyRepository(trx);
                const already = await membershipRepo.findMembership(existing.id, invite.agencyId);
                if (already) {
                    const err = new Error('This account is already connected to this agency.');
                    err.status = 409;
                    throw err;
                }
                // Each agency keeps its own caregiver record (its own schedules and
                // EVV visits hang off it), created from the names entered here.
                const created = await new CaregiverRepository(trx).create({
                    agencyId: invite.agencyId,
                    firstName,
                    lastName,
                    email: invite.email,
                    phone,
                    status: 'active'
                });
                await membershipRepo.create({
                    userId: existing.id,
                    agencyId: invite.agencyId,
                    role: 'caregiver',
                    caregiverId: created.id
                });
                await inviteRepo.markInviteAccepted(inviteId, existing.id, acceptedAt);
                return { invite, user: existing, caregiverId: created.id, inviteId, linkedExistingAccount: true };
            }
            // Create the caregivers row first (when applicable) so we can link
            // the user to it. Non-caregiver roles (admin, coordinator, family)
            // get a user row only.
            let caregiverId;
            if (invite.role === 'caregiver') {
                const created = await new CaregiverRepository(trx).create({
                    agencyId: invite.agencyId,
                    firstName,
                    lastName,
                    email: invite.email,
                    phone,
                    status: 'active'
                });
                caregiverId = created.id;
            }
            const user = await new UserRepository(trx).create({
                agencyId: invite.agencyId,
                email: invite.email,
                passwordHash,
                role: invite.role,
                ...(caregiverId ? { caregiverId } : {})
            });
            // Seed the membership row so user_agencies stays authoritative for
            // every account created from now on (the migration backfills the rest).
            if (hasMemberships) {
                await new UserAgencyRepository(trx).create({
                    userId: user.id,
                    agencyId: invite.agencyId,
                    role: invite.role,
                    ...(caregiverId ? { caregiverId } : {})
                });
            }
            await inviteRepo.markInviteAccepted(inviteId, user.id, acceptedAt);
            return { invite, user, caregiverId, inviteId, linkedExistingAccount: false };
        });
        await audit(db, {
            agencyId: result.invite.agencyId,
            actorId: result.user.id,
            actorType: 'user',
            eventType: 'invite.accepted',
            entityType: 'invite',
            entityId: result.inviteId,
            outcome: 'success',
            payload: {
                userId: result.user.id,
                role: result.invite.role,
                caregiverId: result.caregiverId,
                // True when the invite attached this agency to an existing mobile
                // identity instead of creating a new account. Deliberately does NOT
                // say anything about which other agencies that identity works with.
                linkedExistingAccount: result.linkedExistingAccount
            },
            occurredAt: acceptedAt
        });
        res.status(201).json({
            userId: result.user.id,
            linkedExistingAccount: result.linkedExistingAccount,
            message: result.linkedExistingAccount
                ? 'This agency is now connected to your existing RayHealthEVV account. Sign in with your usual credentials.'
                : `Welcome to ${result.invite.role === 'caregiver' ? 'the team' : 'RayHealth EVV'}.`
        });
    }
    catch (err) {
        const status = err?.status ?? 500;
        const message = status === 500
            ? 'Internal Server Error'
            : err.message;
        const code = err?.code;
        if (status === 500)
            safeError('POST /invitations/accept failed', err);
        res.status(status).json({ message, ...(code ? { code } : {}) });
    }
});
export default router;
//# sourceMappingURL=invitations-routes.js.map