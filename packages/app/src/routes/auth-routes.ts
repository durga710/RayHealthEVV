import { Router } from 'express';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  AuditEventRepository,
  CaregiverRepository,
  MobileSessionRepository,
  SessionRepository,
  UserRepository,
  type NewAuditEvent
} from '@rayhealth/core';
import { authContext } from '../middleware/auth-context.js';
import { requireCsrf } from '../middleware/csrf.js';
import { clearSessionCookieOptions, SESSION_COOKIE_NAME, sessionCookieOptions } from '../security/cookies.js';
import { createOpaqueToken, hashOpaqueToken } from '../security/token-hashing.js';
import { safeError } from '../security/safe-log.js';

const router = Router();
type AuditEventDb = ConstructorParameters<typeof AuditEventRepository>[0];

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is not set');
  return secret;
}

async function recordAuditEvent(db: AuditEventDb, event: NewAuditEvent): Promise<void> {
  try {
    await new AuditEventRepository(db).create(event);
  } catch (error) {
    safeError('Failed to persist auth audit event', error);
  }
}

// Resolve the real end-user IP. Vercel sits behind Cloudflare in this
// deployment, so `req.ip` (with trust proxy = 1) reads the Cloudflare egress
// IP, not the client's. Cloudflare sets `CF-Connecting-IP` with the original
// client IP. Prefer that when present; fall back to req.ip otherwise.
//
// Spoofing concern: a caller hitting Vercel directly could set CF-Connecting-IP
// themselves. That doesn't matter for audit fidelity here because (a) bypass
// traffic is rare and observable, (b) the audit row records WHATEVER the
// caller sent, and (c) the caller still has to satisfy login + CSRF + rate
// limits regardless. For stricter validation we'd verify the upstream IP is
// in Cloudflare's published ranges; out of scope for this pass.
function clientIpFor(req: import('express').Request): string | undefined {
  const cf = req.header('cf-connecting-ip');
  if (cf) return cf.trim();
  return req.ip;
}

// Audit a failed login attempt. Emits `auth.login.failure` with the user
// row when known. Unknown-email attempts cannot resolve to an agency_id
// (NOT NULL) so they are deliberately not persisted at the audit layer
// (agency-scoped table); they remain observable via the rate-limit logs.
async function recordLoginFailure(
  db: AuditEventDb,
  user: { id: string; agencyId: string },
  authMethod: 'session' | 'bearer',
  ipAddress: string | undefined
): Promise<void> {
  await recordAuditEvent(db, {
    agencyId: user.agencyId,
    actorId: user.id,
    actorType: 'user',
    eventType: 'auth.login.failure',
    entityType: 'user',
    entityId: user.id,
    outcome: 'failure',
    payload: { authMethod, ipAddress: ipAddress ?? undefined },
    occurredAt: new Date().toISOString()
  });
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
      await recordLoginFailure(db, user, 'session', clientIpFor(req));
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
      ipAddress: clientIpFor(req),
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

    res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
    res.json({ userId: user.id, role: user.role, agencyId: user.agencyId, csrfToken });
  } catch {
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
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      await recordLoginFailure(db, user, 'bearer', clientIpFor(req));
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Mint a unique jti and persist a mobile_sessions row so the token can
    // be revoked individually on a lost-device event. Without this row the
    // bearer auth path will reject the JWT — see auth-context middleware.
    const jti = randomUUID();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    await new MobileSessionRepository(db).create({
      userId: user.id,
      tokenJti: jti,
      deviceLabel: typeof req.body?.deviceLabel === 'string' ? req.body.deviceLabel : undefined,
      expiresAt
    });

    const token = jwt.sign(
      { sub: user.id, agencyId: user.agencyId, role: user.role, caregiverId: user.caregiverId },
      jwtSecret(),
      { expiresIn: '8h', jwtid: jti }
    );

    await recordAuditEvent(db, {
      agencyId: user.agencyId,
      actorId: user.id,
      actorType: 'user',
      eventType: 'auth.login.success',
      entityType: 'user',
      entityId: user.id,
      outcome: 'success',
      payload: { authMethod: 'bearer', jti },
      occurredAt: new Date().toISOString()
    });

    // Pull display name from the caregivers row (when this user IS a
    // caregiver). The mobile app needs first_name/last_name to greet the
    // user without falling back to their email handle. We do this read
    // AFTER the audit write so a missing/renamed caregiver row degrades
    // gracefully — the login still succeeds with no display name.
    let firstName: string | undefined;
    let lastName: string | undefined;
    if (user.caregiverId) {
      try {
        const caregiver = await new CaregiverRepository(db).findById(user.caregiverId);
        if (caregiver) {
          firstName = caregiver.firstName;
          lastName = caregiver.lastName;
        }
      } catch {
        // Non-fatal: keep login response shape stable even if lookup fails.
      }
    }

    res.json({
      token,
      role: user.role,
      agencyId: user.agencyId,
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {})
    });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Mobile logout — revoke the active mobile_sessions row by jti.
//
// Authenticated via authContext (bearer JWT). Revocation is idempotent so a
// re-tried logout from a flaky device just succeeds. After revocation the
// JWT itself remains technically valid until expiry, but auth-context will
// reject it because findActiveByJti returns nothing.
router.post('/mobile/logout', authContext, async (req, res) => {
  if (req.auth.authMethod !== 'bearer' || !req.auth.tokenJti) {
    res.status(400).json({ message: 'No mobile session to revoke' });
    return;
  }
  const db = req.app.get('db');
  const now = new Date().toISOString();
  await new MobileSessionRepository(db).revokeByJti(req.auth.tokenJti, now);
  await recordAuditEvent(db, {
    agencyId: req.auth.agencyId,
    actorId: req.auth.userId,
    actorType: 'user',
    eventType: 'session.revoked',
    entityType: 'mobile_session',
    entityId: req.auth.userId,
    outcome: 'success',
    payload: { authMethod: 'bearer', jti: req.auth.tokenJti },
    occurredAt: now
  });
  res.status(204).send();
});

// One-time admin bootstrap — serialized via advisory lock so concurrent requests cannot both succeed.
//
// Defense in depth: bootstrap is also gated by BOOTSTRAP_SECRET. Without that env
// var, the endpoint is fully disabled — the inherited "wipe-DB-and-bootstrap-yourself-
// to-admin" attack (e.g. after a stolen point-in-time backup gets restored) is closed
// out unless the attacker also has the secret. Compared with constant time so a 401
// vs 403 timing oracle does not leak whether the var is configured.
router.post('/bootstrap', async (req, res) => {
  const expected = process.env.BOOTSTRAP_SECRET;
  if (!expected) {
    res.status(403).json({ message: 'Bootstrap is disabled' });
    return;
  }
  const provided = req.header('x-bootstrap-secret') ?? '';
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  const same =
    expectedBuf.length === providedBuf.length &&
    timingSafeEqual(expectedBuf, providedBuf);
  if (!same) {
    res.status(403).json({ message: 'Bootstrap is disabled' });
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

    const user = await db.transaction(async (trx: typeof db) => {
      // Advisory lock serializes all concurrent bootstrap attempts at the DB level.
      await trx.raw('SELECT pg_advisory_xact_lock(1073741823)');
      const [{ count }] = await trx('users').count('id as count');
      if (Number(count) > 0) {
        const err = new Error('Bootstrap already completed') as Error & { status: number };
        err.status = 409;
        throw err;
      }
      return new UserRepository(trx).create({ agencyId, email, passwordHash, role: 'admin' });
    });

    const token = jwt.sign(
      { sub: user.id, agencyId: user.agencyId, role: user.role },
      jwtSecret(),
      { expiresIn: '8h' }
    );

    res.status(201).json({ token, role: user.role, agencyId: user.agencyId });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 409) {
      res.status(409).json({ message: 'Bootstrap already completed' });
    } else {
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
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Protected — authContext applied directly so this route isn't bypassed by mount order.
router.get('/me', authContext, async (req, res) => {
  const { userId, role, agencyId } = req.auth;
  if (req.auth.authMethod === 'session' && req.auth.sessionId) {
    const csrfToken = createOpaqueToken();
    await new SessionRepository(req.app.get('db')).rotateCsrfToken(req.auth.sessionId, hashOpaqueToken(csrfToken));
    res.json({ userId, role, agencyId, csrfToken });
    return;
  }

  res.json({ userId, role, agencyId });
});

export default router;
