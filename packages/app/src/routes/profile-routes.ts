import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { safeError } from '../security/safe-log.js';

const router = Router();

const MAX_AVATAR_BYTES = 300_000;

const profileSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName:  z.string().max(100).optional(),
  phone:     z.string().max(30).optional(),
  avatarUrl: z.string().max(MAX_AVATAR_BYTES).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(12, 'Password must be at least 12 characters'),
});

// GET /profile — current user's profile
router.get('/', async (req, res) => {
  try {
    const db  = req.app.get('db');
    type UserRow = {
      id: string; email: string; role: string;
      first_name: string | null; last_name: string | null;
      phone: string | null; avatar_url: string | null;
      created_at: string;
    };
    const row = await db('users')
      .where({ id: req.auth.userId })
      .select('id', 'email', 'role', 'first_name', 'last_name', 'phone', 'avatar_url', 'created_at')
      .first() as UserRow | undefined;

    if (!row) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      id:        row.id,
      email:     row.email,
      role:      row.role,
      firstName: row.first_name ?? '',
      lastName:  row.last_name  ?? '',
      phone:     row.phone      ?? '',
      avatarUrl: row.avatar_url ?? null,
      createdAt: row.created_at,
    });
  } catch (err) {
    safeError('GET /profile failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PATCH /profile — update name / phone / avatar
router.patch('/', async (req, res) => {
  const parse = profileSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: parse.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }

  const { firstName, lastName, phone, avatarUrl } = parse.data;

  if (avatarUrl) {
    const ok = avatarUrl.startsWith('data:image/') || avatarUrl.startsWith('https://');
    if (!ok) {
      res.status(400).json({ message: 'avatarUrl must be a data URL or https URL' });
      return;
    }
  }

  try {
    const db = req.app.get('db');
    const patch: Record<string, unknown> = { updated_at: db.fn.now() };
    if (firstName !== undefined) patch.first_name = firstName || null;
    if (lastName  !== undefined) patch.last_name  = lastName  || null;
    if (phone     !== undefined) patch.phone      = phone     || null;
    if (avatarUrl !== undefined) patch.avatar_url = avatarUrl || null;

    await db('users').where({ id: req.auth.userId }).update(patch);
    res.json({ ok: true });
  } catch (err) {
    safeError('PATCH /profile failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST /profile/change-password
router.post('/change-password', async (req, res) => {
  const parse = changePasswordSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: parse.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }

  const { currentPassword, newPassword } = parse.data;

  try {
    const db  = req.app.get('db');
    const row = await db('users')
      .where({ id: req.auth.userId })
      .select('password_hash')
      .first() as { password_hash: string } | undefined;

    if (!row) { res.status(404).json({ message: 'User not found' }); return; }

    const matches = await bcrypt.compare(currentPassword, row.password_hash);
    if (!matches) {
      res.status(401).json({ message: 'Current password is incorrect' });
      return;
    }
    if (currentPassword === newPassword) {
      res.status(400).json({ message: 'New password must differ from current password' });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await db('users').where({ id: req.auth.userId }).update({ password_hash: hash, updated_at: db.fn.now() });
    res.json({ ok: true });
  } catch (err) {
    safeError('POST /profile/change-password failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
