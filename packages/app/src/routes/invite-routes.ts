import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireCapability } from '../middleware/require-capability.js';
import {
  AgencyRepository,
  AuditEventRepository,
  CaregiverRepository,
  UserRepository,
  type NewAuditEvent
} from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';
import { createEmailClient, buildInviteUrl, type EmailClient } from '../email/email-client.js';

const router = Router();

const VALID_ROLES = ['admin', 'coordinator', 'caregiver', 'family'] as const;
type InviteRole = (typeof VALID_ROLES)[number];

const DEFAULT_EXPIRES_DAYS = 14;
const MAX_EXPIRES_DAYS = 60;

type AuditDb = ConstructorParameters<typeof AuditEventRepository>[0];
async function audit(db: AuditDb, event: NewAuditEvent): Promise<void> {
  try {
    await new AuditEventRepository(db).create(event);
  } catch (err) {
    safeError('failed to persist invite audit event', err);
  }
}

/**
 * Tag the response with the outcome of the email-delivery side-effect.
 * The web UI uses this to choose between the "we emailed it" copy and
 * the "copy this link" fallback. `'not_configured'` is distinct from
 * `'failed'` because it's an operator action (set the env var) rather
 * than a transient retry.
 */
type EmailDeliveryStatus = 'sent' | 'failed' | 'not_configured';

interface DeliveryOutcome {
  status: EmailDeliveryStatus;
  messageId?: string;
  errorCategory?: string;
}

/**
 * Drive the email send + audit for one invite. Pure side-effects — never
 * throws. Returns a small object the route handler can attach to the
 * response and the UI can switch on.
 *
 * NOTE: callers MUST pass `inviteUrl` already built via `buildInviteUrl()`.
 * We do not log it here and the audit payload deliberately omits it —
 * the URL contains the share-token and is treated as the equivalent of
 * a temporary password.
 */
async function deliverInviteEmail(
  db: AuditDb,
  emailClient: EmailClient,
  args: {
    agencyId: string;
    actorId: string;
    inviteId: string;
    to: string;
    inviteUrl: string;
    agencyName: string;
    role: string;
    expiresAt: string;
    invitedByName?: string;
  }
): Promise<DeliveryOutcome> {
  let result: Awaited<ReturnType<EmailClient['sendInviteEmail']>>;
  try {
    result = await emailClient.sendInviteEmail({
      to: args.to,
      inviteUrl: args.inviteUrl,
      agencyName: args.agencyName,
      role: args.role,
      expiresAt: args.expiresAt,
      invitedByName: args.invitedByName
    });
  } catch (err) {
    // sendInviteEmail is documented as never-throwing, but belt-and-braces:
    // if a future provider changes the contract we still don't 500 the
    // invite-creation request.
    safeError('emailClient.sendInviteEmail threw', err);
    result = { ok: false, error: 'UNEXPECTED_THROW' };
  }

  const now = new Date().toISOString();
  if (result.ok) {
    await audit(db, {
      agencyId: args.agencyId,
      actorId: args.actorId,
      actorType: 'user',
      eventType: 'invite.email.sent',
      entityType: 'invite',
      entityId: args.inviteId,
      outcome: 'success',
      payload: { messageId: result.id },
      occurredAt: now,
    });
    return { status: 'sent', messageId: result.id };
  }

  // EMAIL_NOT_CONFIGURED is a distinct UX outcome (operator hasn't set
  // AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY yet) rather than a transient
  // failure — log it as a
  // failure event so it shows up in the audit feed, but tag the
  // response with the dedicated status so the UI shows the manual-copy
  // fallback rather than a scary error.
  if (result.error === 'EMAIL_NOT_CONFIGURED') {
    await audit(db, {
      agencyId: args.agencyId,
      actorId: args.actorId,
      actorType: 'system',
      eventType: 'invite.email.failed',
      entityType: 'invite',
      entityId: args.inviteId,
      outcome: 'failure',
      payload: { error: 'EMAIL_NOT_CONFIGURED' },
      occurredAt: now,
    });
    return { status: 'not_configured', errorCategory: 'EMAIL_NOT_CONFIGURED' };
  }

  await audit(db, {
    agencyId: args.agencyId,
    actorId: args.actorId,
    actorType: 'user',
    eventType: 'invite.email.failed',
    entityType: 'invite',
    entityId: args.inviteId,
    outcome: 'failure',
    payload: { error: result.error },
    occurredAt: now,
  });
  return { status: 'failed', errorCategory: result.error };
}

/**
 * Resend-email rate limit — 5 attempts per 15-min per IP.
 *
 * Bounded so a compromised admin session can't be turned into a free
 * email-spam relay against an arbitrary inbox. Each call requires a
 * valid CSRF token + admin capability, but the rate limit is the
 * defense-in-depth layer if the other two are bypassed.
 *
 * Skipped under tests — supertest hits from the same IP and this
 * limiter is module-scoped, so cumulative test request counts could
 * trip it.
 */
const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many resend attempts. Try again in 15 minutes.' },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Admin/coordinator-only. Persists a `staff_invites` row and returns the
 * row id (which IS the share-token — UUID v4 has ~122 bits of entropy,
 * enough to be unguessable). The admin shares the resulting URL with
 * the new staff member, who hits POST /invitations/accept with it.
 *
 * After the row is persisted we trigger the email send. The send is a
 * best-effort side-effect — its outcome is surfaced via `emailDelivery`
 * in the response but never causes the request to fail. This keeps the
 * manual-copy fallback flow working when:
 *  - AWS SES credentials are unset (returns `emailDelivery: 'not_configured'`)
 *  - The upstream API is having a bad day (returns `'failed'`)
 *
 * Security note: we never log the invite URL or the access token in any
 * logger — they're equivalent to a temporary password.
 */
router.post('/', requireCapability('staff.write'), async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = typeof body.role === 'string' ? (body.role as InviteRole) : ('caregiver' as InviteRole);
  const expiresInDaysRaw = Number(body.expiresInDays ?? DEFAULT_EXPIRES_DAYS);
  const expiresInDays =
    Number.isFinite(expiresInDaysRaw) && expiresInDaysRaw > 0
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
    const inviteId: string = invite.id ?? '';

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

    // ---------- Email delivery (best effort) ----------
    // Resolve display metadata for the email body. Both lookups are
    // optional — if they fail we still send the email with sensible
    // defaults; the invite itself is already persisted.
    let agencyName = 'your care agency';
    let invitedByName: string | undefined;
    try {
      const agency = await new AgencyRepository(db).findById(req.auth.agencyId);
      if (agency?.name) agencyName = agency.name;
    } catch (err) {
      safeError('invite.email: agency lookup failed', err);
    }
    try {
      const inviter = await new UserRepository(db).findById(req.auth.userId);
      if (inviter?.email) invitedByName = inviter.email;
    } catch (err) {
      safeError('invite.email: inviter lookup failed', err);
    }

    const inviteUrl = buildInviteUrl(inviteId);
    const delivery = await deliverInviteEmail(db, createEmailClient(), {
      agencyId: req.auth.agencyId,
      actorId: req.auth.userId,
      inviteId,
      to: email,
      inviteUrl,
      agencyName,
      role,
      expiresAt,
      invitedByName,
    });

    res.status(201).json({
      id: inviteId,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt,
      // Surface the path the inviter should share. Front-ends compose
      // the absolute URL by joining with their origin. Kept even when
      // email delivery succeeds, so the admin can copy it as a backup
      // (e.g. recipient says "the email never arrived").
      acceptPath: `/accept-invite?token=${encodeURIComponent(inviteId)}`,
      emailDelivery: delivery.status,
    });
  } catch (err) {
    safeError('POST /invites failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * Re-send the invite email for an existing pending invite.
 *
 * Used by the admin's "Resend email" button when the recipient says
 * they never got the original (or the first send failed). Guards:
 *  - admin/coordinator capability (`staff.write`)
 *  - invite must exist and belong to the caller's agency
 *  - invite must be `status='pending'` (already-accepted invites can't
 *    be re-emailed — the token is single-use and burned)
 *  - invite must not be expired
 *  - rate-limited to 5 / 15-min per IP (anti-spam)
 *
 * The endpoint never returns the invite URL in the response body —
 * the inviter already has the original via `acceptPath` if they need it.
 * Returning it here would create a second, less-audited disclosure path.
 */
router.post(
  '/:id/resend-email',
  resendLimiter,
  requireCapability('staff.write'),
  async (req, res) => {
    // Express 5 types `req.params[name]` as `string | string[]` to handle
    // wildcard params; for `:id` the runtime always gives us a string,
    // but we narrow defensively here.
    const rawId = req.params.id;
    const inviteId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!inviteId || typeof inviteId !== 'string') {
      res.status(400).json({ message: 'invite id is required' });
      return;
    }

    try {
      const db = req.app.get('db');
      const repo = new CaregiverRepository(db);
      const invite = await repo.findInviteById(inviteId);

      // Generic 404 for cross-agency or unknown ids — don't confirm
      // whether an unknown UUID was ever issued.
      if (!invite || invite.agencyId !== req.auth.agencyId) {
        res.status(404).json({ message: 'invite not found' });
        return;
      }

      if (invite.status !== 'pending' || invite.acceptedAt) {
        res.status(409).json({
          message: 'invite is no longer pending',
          status: invite.status,
        });
        return;
      }

      const expiresAt = invite.expiresAt;
      if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
        res.status(410).json({ message: 'invite has expired' });
        return;
      }

      let agencyName = invite.agencyName?.trim() || 'your care agency';
      let invitedByName: string | undefined;
      try {
        if (!invite.agencyName) {
          const agency = await new AgencyRepository(db).findById(req.auth.agencyId);
          if (agency?.name) agencyName = agency.name;
        }
      } catch (err) {
        safeError('invite.email.resend: agency lookup failed', err);
      }
      try {
        const inviter = await new UserRepository(db).findById(req.auth.userId);
        if (inviter?.email) invitedByName = inviter.email;
      } catch (err) {
        safeError('invite.email.resend: inviter lookup failed', err);
      }

      const inviteUrl = buildInviteUrl(inviteId);
      const delivery = await deliverInviteEmail(db, createEmailClient(), {
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        inviteId,
        to: invite.email,
        inviteUrl,
        agencyName,
        role: invite.role,
        expiresAt,
        invitedByName,
      });

      res.status(200).json({
        id: inviteId,
        email: invite.email,
        emailDelivery: delivery.status,
      });
    } catch (err) {
      safeError('POST /invites/:id/resend-email failed', err);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  }
);

export default router;
