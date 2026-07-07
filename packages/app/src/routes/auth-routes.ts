import { Router } from 'express';
import type { Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { AgencyRepository, AuditEventRepository, CaregiverRepository, MobileSessionRepository, PasswordResetRepository, SessionRepository, UserAgencyRepository, UserRepository, type NewAuditEvent, type AppRole } from '@rayhealth/core';
import { authContext } from '../middleware/auth-context.js';
import { requireCsrf } from '../middleware/csrf.js';
import { clearSessionCookieOptions, SESSION_COOKIE_NAME, sessionCookieOptions } from '../security/cookies.js';
import { createOpaqueToken, hashOpaqueToken } from '../security/token-hashing.js';
import { createEmailClient, buildPasswordResetUrl } from '../email/email-client.js';
import { safeError } from '../security/safe-log.js';
import { CURRENT_TERMS_VERSION } from '../terms.js';
import { verifySync } from 'otplib';

const router = Router();
type AuditEventDb = ConstructorParameters<typeof AuditEventRepository>[0];

/**
 * A valid cost-12 bcrypt hash (of a throwaway string, NOT a real credential)
 * used only to equalize response timing on the "user not found" path so an
 * attacker cannot enumerate registered emails by measuring how long a login
 * takes. Its cost factor matches the real hashes produced by bcrypt.hash(_, 12).
 */
const DUMMY_PASSWORD_HASH = '$2b$12$df0z.PFd7acWE5orxTvFmOnjqLdyh92rNGAOmR5RicwgyE18g7Vsm';

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is not set');
  return secret;
}

/**
 * Login gate enforced after the password check: a suspended account or an
 * agency that the platform super-admin hasn't approved cannot sign in. The
 * fields come from UserRepository.findByEmail (R21+); when they're undefined
 * (older data / mocked tests) the login is not gated.
 */
function loginGate(user: { suspendedAt?: string | null; agencyReviewStatus?: string }):
  | { code: string; message: string }
  | null {
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

async function recordAuditEvent(db: AuditEventDb, event: NewAuditEvent): Promise<void> {
  try {
    await new AuditEventRepository(db).create(event);
  } catch (error) {
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

    type ProfileRow = { email: string; first_name: string | null; last_name: string | null; avatar_url: string | null };
    const [agencyTheme, profileRow] = await Promise.all([
      new AgencyRepository(db).findTheme(user.agencyId).catch(() => null),
      (db('users').where({ id: user.id }).select('email', 'first_name', 'last_name', 'avatar_url').first().catch(() => null)) as Promise<ProfileRow | null>,
    ]);
    const profile = {
      email:     profileRow?.email      ?? user.email ?? null,
      firstName: profileRow?.first_name ?? null,
      lastName:  profileRow?.last_name  ?? null,
      avatarUrl: profileRow?.avatar_url ?? null,
    };
    res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
    res.json({ userId: user.id, role: user.role, agencyId: user.agencyId, csrfToken, agencyTheme, ...profile });
  } catch {
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
    let userId: string;
    try {
      const payload = jwt.verify(challengeToken, jwtSecret(), { algorithms: ['HS256'] }) as { sub?: string; purpose?: string };
      if (payload.purpose !== '2fa' || !payload.sub) throw new Error('bad challenge');
      userId = payload.sub;
    } catch {
      res.status(401).json({ message: 'Your verification session expired. Please sign in again.' });
      return;
    }

    const db = req.app.get('db');
    type Row = {
      id: string; agency_id: string; role: AppRole; caregiver_id: string | null;
      email: string; first_name: string | null; last_name: string | null; avatar_url: string | null;
      totp_secret: string | null; totp_enabled: boolean; totp_backup_codes: string[] | null;
    };
    const row = (await db('users').where({ id: userId }).first()) as Row | undefined;
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
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * Every agency the user may act in, for the mobile agency picker. Falls back
 * to the user's home agency when the user_agencies table hasn't been migrated
 * or backfilled yet, so login keeps working against an older database.
 */
async function listMobileAgencies(
  db: AuditEventDb,
  user: { id: string; agencyId: string; role: string },
): Promise<Array<{ agencyId: string; agencyName: string; role: string }>> {
  try {
    const memberships = await new UserAgencyRepository(db).listActiveForUser(user.id);
    if (memberships.length > 0) {
      return memberships.map((m) => ({ agencyId: m.agencyId, agencyName: m.agencyName, role: m.role }));
    }
  } catch {
    /* pre-migration database — fall through to the home agency */
  }
  let agencyName = '';
  try {
    agencyName = (await new AgencyRepository(db).findById(user.agencyId))?.name ?? '';
  } catch {
    /* name is cosmetic — never block login on it */
  }
  return [{ agencyId: user.agencyId, agencyName, role: user.role }];
}

const MOBILE_TOKEN_TTL_SECONDS = 8 * 60 * 60;

/**
 * Issue a revocable mobile bearer token. Each token carries a `jti` backed by a
 * `mobile_sessions` row, so logout and password-reset can terminate it
 * server-side — a valid signature alone is no longer sufficient to authenticate
 * (see authContext). Returns the signed JWT.
 */
async function issueMobileToken(
  db: AuditEventDb,
  claims: { sub: string; agencyId: string; role: string; caregiverId?: string },
  deviceLabel?: string,
): Promise<string> {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + MOBILE_TOKEN_TTL_SECONDS * 1000).toISOString();
  await new MobileSessionRepository(db).create({
    userId: claims.sub,
    tokenJti: jti,
    deviceLabel,
    expiresAt,
  });
  return jwt.sign(claims, jwtSecret(), {
    expiresIn: MOBILE_TOKEN_TTL_SECONDS,
    algorithm: 'HS256',
    jwtid: jti,
  });
}

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

    // If the user enrolled TOTP 2FA, do not mint a bearer token yet — issue a
    // short-lived challenge and require the second factor via /mobile/login/2fa.
    // This mirrors the web /login flow so 2FA is enforced on mobile too.
    if (user.totpEnabled) {
      const challengeToken = jwt.sign({ sub: user.id, purpose: '2fa' }, jwtSecret(), { expiresIn: '5m' });
      res.json({ twoFactorRequired: true, challengeToken });
      return;
    }

    const token = await issueMobileToken(db, {
      sub: user.id,
      agencyId: user.agencyId,
      role: user.role,
      caregiverId: user.caregiverId,
    });

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

    // agencies powers the post-login agency picker: >1 entry means the app
    // must prompt before showing any agency-scoped data. The token above is
    // scoped to the home agency; /mobile/switch-agency swaps it.
    const agencies = await listMobileAgencies(db, user);
    res.json({ token, role: user.role, agencyId: user.agencyId, agencies });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Second factor for mobile: exchange a challenge token + TOTP/backup code for a
// revocable bearer token. Mirrors POST /login/2fa but returns a mobile token +
// agency list instead of a cookie session.
router.post('/mobile/login/2fa', async (req, res) => {
  const { challengeToken, code } = req.body ?? {};
  if (!challengeToken || !code) {
    res.status(400).json({ message: 'challengeToken and code are required' });
    return;
  }
  try {
    let userId: string;
    try {
      const payload = jwt.verify(challengeToken, jwtSecret(), { algorithms: ['HS256'] }) as { sub?: string; purpose?: string };
      if (payload.purpose !== '2fa' || !payload.sub) throw new Error('bad challenge');
      userId = payload.sub;
    } catch {
      res.status(401).json({ message: 'Your verification session expired. Please sign in again.' });
      return;
    }

    const db = req.app.get('db');
    type Row = {
      id: string; agency_id: string; role: AppRole; caregiver_id: string | null;
      totp_secret: string | null; totp_enabled: boolean; totp_backup_codes: string[] | null;
    };
    const row = (await db('users').where({ id: userId }).first()) as Row | undefined;
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

    const token = await issueMobileToken(db, {
      sub: row.id,
      agencyId: row.agency_id,
      role: row.role,
      caregiverId: row.caregiver_id ?? undefined,
    });

    await recordAuditEvent(db, {
      agencyId: row.agency_id,
      actorId: row.id,
      actorType: 'user',
      eventType: 'auth.login.success',
      entityType: 'user',
      entityId: row.id,
      outcome: 'success',
      payload: { authMethod: 'bearer', secondFactor: 'totp' },
      occurredAt: new Date().toISOString(),
    });

    const agencies = await listMobileAgencies(db, { id: row.id, agencyId: row.agency_id, role: row.role });
    res.json({ token, role: row.role, agencyId: row.agency_id, agencies });
  } catch {
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
    const result = await db.transaction(async (trx: typeof db) => {
      const existingUser = await new UserRepository(trx).findByEmail(adminEmail);
      if (existingUser) {
        const err = new Error('Email already registered') as Error & { status: number };
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
        agencyId: agency.id!,
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
      message:
        'Your agency has been registered and is awaiting review. You will be able to sign in once approved.',
    });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 409) {
      res.status(409).json({ message: 'Email already registered' });
    } else {
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
  if (
    expectedBuf.length !== providedBuf.length ||
    !timingSafeEqual(expectedBuf, providedBuf)
  ) {
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

    // Issue a revocable bearer token (jti + mobile_sessions row) so it satisfies
    // authContext, which now requires every bearer token to be server-revocable.
    const token = await issueMobileToken(db, {
      sub: user.id,
      agencyId: user.agencyId,
      role: user.role,
    }, 'bootstrap');

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
    const db = req.app.get('db');
    const nowIso = new Date().toISOString();
    if (req.auth.authMethod === 'session' && req.auth.sessionId) {
      await new SessionRepository(db).revokeById(req.auth.sessionId, nowIso);
      await recordAuditEvent(db, {
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'session.revoked',
        entityType: 'session',
        entityId: req.auth.sessionId,
        outcome: 'success',
        payload: { authMethod: req.auth.authMethod },
        occurredAt: nowIso
      });
    } else if (req.auth.authMethod === 'bearer' && req.auth.tokenJti) {
      // Revoke the mobile bearer token server-side so it can't be replayed.
      await new MobileSessionRepository(db).revokeByJti(req.auth.tokenJti, nowIso);
      await recordAuditEvent(db, {
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'session.revoked',
        entityType: 'mobile_session',
        entityId: req.auth.tokenJti,
        outcome: 'success',
        payload: { authMethod: req.auth.authMethod },
        occurredAt: nowIso
      });
    }
    res.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions());
    res.status(204).send();
  } catch {
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
  } catch (err) {
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

    await db.transaction(async (trx: typeof db) => {
      const nowIso = new Date().toISOString();
      await trx('users').where('id', resetToken.userId).update({ password_hash: passwordHash });
      await resetRepo.markUsed(resetToken.id);
      // Revoke all active sessions for security — both web cookie sessions and
      // mobile bearer tokens, so a reset terminates every active session.
      await trx('sessions').where('user_id', resetToken.userId).whereNull('revoked_at').update({
        revoked_at: nowIso,
      });
      await new MobileSessionRepository(trx).revokeAllForUser(resetToken.userId, nowIso);
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
  } catch (err) {
    safeError('POST /auth/reset-password failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Protected — authContext applied directly so this route isn't bypassed by mount order.
async function sendAuthProfile(req: Request, res: Response): Promise<void> {
  const { userId, role, agencyId, caregiverId } = req.auth;
  const db = req.app.get('db');

  const [agencyTheme, user, caregiver] = await Promise.all([
    new AgencyRepository(db).findTheme(agencyId).catch(() => null),
    new UserRepository(db).findById(userId),
    caregiverId ? new CaregiverRepository(db).findById(caregiverId, agencyId) : Promise.resolve(null),
  ]);

  const profile = {
    email:     user?.email ?? null,
    firstName: caregiver?.firstName ?? null,
    lastName:  caregiver?.lastName ?? null,
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

// GET /auth/mobile/agencies — every agency the signed-in user may act in,
// plus which one the current token is scoped to. Powers the "Linked agencies"
// screen and the post-login picker on token-restore.
router.get('/mobile/agencies', authContext, async (req, res) => {
  try {
    const db = req.app.get('db');
    const { userId, agencyId, role } = req.auth;
    const agencies = await listMobileAgencies(db, { id: userId, agencyId, role });
    res.json({ agencies, currentAgencyId: agencyId });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

const switchAgencySchema = z.object({ agencyId: z.string().uuid() });

// POST /auth/mobile/switch-agency — re-scope the caller's bearer token to
// another agency they hold an active membership in. Issues a fresh JWT whose
// agencyId/role/caregiverId claims come from that membership, so every
// downstream tenant check keeps reading req.auth exactly as before.
router.post('/mobile/switch-agency', authContext, requireCsrf, async (req, res) => {
  const parsed = switchAgencySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: 'agencyId (uuid) required' });
    return;
  }

  try {
    const db = req.app.get('db');
    const { userId } = req.auth;
    const membership = await new UserAgencyRepository(db).findMembership(userId, parsed.data.agencyId);

    // One generic denial for missing/disconnected/unapproved so the endpoint
    // can't be used to probe which agencies exist.
    const allowed =
      membership &&
      membership.status === 'active' &&
      (membership.agencyReviewStatus === undefined || membership.agencyReviewStatus === 'approved');
    if (!allowed) {
      res.status(403).json({ code: 'AGENCY_ACCESS_DENIED', message: 'You do not have access to this agency.' });
      return;
    }

    const token = await issueMobileToken(db, {
      sub: userId,
      agencyId: membership.agencyId,
      role: membership.role,
      caregiverId: membership.caregiverId,
    });

    // Invalidate the token being switched away from so only one mobile token is
    // live per device after a re-scope.
    if (req.auth.tokenJti) {
      await new MobileSessionRepository(db).revokeByJti(req.auth.tokenJti, new Date().toISOString());
    }

    await recordAuditEvent(db, {
      agencyId: membership.agencyId,
      actorId: userId,
      actorType: 'user',
      eventType: 'auth.agency_switch',
      entityType: 'user',
      entityId: userId,
      outcome: 'success',
      payload: { fromAgencyId: req.auth.agencyId, authMethod: req.auth.authMethod },
      occurredAt: new Date().toISOString(),
    });

    res.json({
      token,
      role: membership.role,
      agencyId: membership.agencyId,
      agencyName: membership.agencyName,
    });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
