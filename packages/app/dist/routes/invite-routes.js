import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { AuditEventRepository, CaregiverRepository } from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';
const router = Router();
const VALID_ROLES = ['admin', 'coordinator', 'caregiver', 'family'];
const DEFAULT_EXPIRES_DAYS = 14;
const MAX_EXPIRES_DAYS = 60;
async function audit(db, event) {
    try {
        await new AuditEventRepository(db).create(event);
    }
    catch (err) {
        safeError('failed to persist invite audit event', err);
    }
}
/**
 * Admin/coordinator-only. Persists a `staff_invites` row and returns the
 * row id (which IS the share-token — UUID v4 has ~122 bits of entropy,
 * enough to be unguessable). The admin shares the resulting URL with
 * the new staff member, who hits POST /invitations/accept with it.
 *
 * Replaces the prior stub that returned a random object without
 * persisting. Now actually writes to the DB and records an audit event.
 */
router.post('/', requireCapability('staff.write'), async (req, res) => {
    const body = (req.body ?? {});
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = typeof body.role === 'string' ? body.role : 'caregiver';
    const expiresInDaysRaw = Number(body.expiresInDays ?? DEFAULT_EXPIRES_DAYS);
    const expiresInDays = Number.isFinite(expiresInDaysRaw) && expiresInDaysRaw > 0
        ? Math.min(MAX_EXPIRES_DAYS, Math.floor(expiresInDaysRaw))
        : DEFAULT_EXPIRES_DAYS;
    if (!email || !email.includes('@')) {
        res.status(400).json({ message: 'valid email is required' });
        return;
    }
    if (!VALID_ROLES.includes(role)) {
        res.status(400).json({ message: `role must be one of: ${VALID_ROLES.join(', ')}` });
        return;
    }
    try {
        const db = req.app.get('db');
        const repo = new CaregiverRepository(db);
        const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
        const invite = await repo.createInvite({
            agencyId: req.auth.agencyId,
            email,
            role,
            status: 'pending',
            invitedBy: req.auth.userId,
            expiresAt,
        });
        // staffInviteSchema marks id as `.optional()` for the insert shape;
        // the row returned from createInvite always has the DB-assigned UUID,
        // so we narrow here.
        const inviteId = invite.id ?? '';
        await audit(db, {
            agencyId: req.auth.agencyId,
            actorId: req.auth.userId,
            actorType: 'user',
            eventType: 'invite.created',
            entityType: 'invite',
            entityId: inviteId,
            outcome: 'success',
            payload: { email, role, expiresAt },
            occurredAt: new Date().toISOString(),
        });
        res.status(201).json({
            id: inviteId,
            email: invite.email,
            role: invite.role,
            status: invite.status,
            expiresAt: invite.expiresAt,
            // Surface the path the inviter should share. Front-ends compose
            // the absolute URL by joining with their origin.
            acceptPath: `/accept-invite?token=${encodeURIComponent(inviteId)}`,
        });
    }
    catch (err) {
        safeError('POST /invites failed', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
export default router;
//# sourceMappingURL=invite-routes.js.map