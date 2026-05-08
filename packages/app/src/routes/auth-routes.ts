import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '@rayhealth/core';
import { authContext } from '../middleware/auth-context.js';

const router = Router();

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is not set');
  return secret;
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

    const token = jwt.sign(
      { sub: user.id, agencyId: user.agencyId, role: user.role, caregiverId: user.caregiverId },
      jwtSecret(),
      { expiresIn: '8h' }
    );

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

// Protected — authContext applied directly so this route isn't bypassed by mount order.
router.get('/me', authContext, (req, res) => {
  const { userId, role, agencyId } = req.auth;
  res.json({ userId, role, agencyId });
});

export default router;
