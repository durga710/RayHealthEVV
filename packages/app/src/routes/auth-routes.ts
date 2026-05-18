import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuditEventRepository, SessionRepository, UserRepository, type NewAuditEvent } from '@rayhealth/core';
import { authContext } from '../middleware/auth-context.js';
import { requireCsrf } from '../middleware/csrf.js';
import { clearSessionCookieOptions, SESSION_COOKIE_NAME, sessionCookieOptions } from '../security/cookies.js';
import { createOpaqueToken, hashOpaqueToken } from '../security/token-hashing.js';

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
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { sub: user.id, agencyId: user.agencyId, role: user.role, caregiverId: user.caregiverId },
      jwtSecret(),
      { expiresIn: '8h' }
    );

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
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
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
