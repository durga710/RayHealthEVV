import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import { SessionRepository } from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';

/**
 * Account settings, security (TOTP 2FA), active sessions, notification
 * preferences, appearance/locale preferences, data export, and account
 * deletion requests. Mounted under /settings on the authenticated surface,
 * so authContext + requireCsrf are already applied by app.ts.
 */
const router = Router();

const TOTP_ISSUER = 'RayHealthEVV';
const BACKUP_CODE_COUNT = 10;

const notificationPrefsSchema = z
  .object({
    channelEmail: z.boolean(),
    channelSms: z.boolean(),
    channelInApp: z.boolean(),
    visitReminders: z.boolean(),
    scheduleChanges: z.boolean(),
    trainingDue: z.boolean(),
    billingAlerts: z.boolean(),
    productUpdates: z.boolean(),
  })
  .partial();

const preferencesSchema = z
  .object({
    timezone: z.string().max(64),
    language: z.string().max(16),
    theme: z.enum(['system', 'light', 'dark']),
  })
  .partial();

function generateBackupCodes(): string[] {
  // 10 codes, 10 chars each (grouped 5-5), ambiguous characters removed.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i += 1) {
    let code = '';
    const bytes = new Uint8Array(10);
    globalThis.crypto.getRandomValues(bytes);
    for (let j = 0; j < 10; j += 1) {
      code += alphabet[bytes[j] % alphabet.length];
      if (j === 4) code += '-';
    }
    codes.push(code);
  }
  return codes;
}

// GET /settings, security + notification + preference summary
router.get('/', async (req, res) => {
  try {
    const db = req.app.get('db');
    const row = (await db('users')
      .where({ id: req.auth.userId })
      .select('totp_enabled', 'notification_prefs', 'preferences', 'deletion_requested_at')
      .first()) as
      | { totp_enabled: boolean; notification_prefs: Record<string, unknown> | null; preferences: Record<string, unknown> | null; deletion_requested_at: string | null }
      | undefined;
    if (!row) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json({
      twoFactorEnabled: Boolean(row.totp_enabled),
      notificationPrefs: row.notification_prefs ?? null,
      preferences: row.preferences ?? null,
      deletionRequestedAt: row.deletion_requested_at ?? null,
    });
  } catch (err) {
    safeError('GET /settings failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PATCH /settings/notifications
router.patch('/notifications', async (req, res) => {
  const parse = notificationPrefsSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: parse.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }
  try {
    const db = req.app.get('db');
    const existing = (await db('users').where({ id: req.auth.userId }).select('notification_prefs').first()) as
      | { notification_prefs: Record<string, unknown> | null }
      | undefined;
    const merged = { ...(existing?.notification_prefs ?? {}), ...parse.data };
    await db('users')
      .where({ id: req.auth.userId })
      .update({ notification_prefs: JSON.stringify(merged), updated_at: db.fn.now() });
    res.json({ ok: true, notificationPrefs: merged });
  } catch (err) {
    safeError('PATCH /settings/notifications failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PATCH /settings/preferences
router.patch('/preferences', async (req, res) => {
  const parse = preferencesSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: parse.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }
  try {
    const db = req.app.get('db');
    const existing = (await db('users').where({ id: req.auth.userId }).select('preferences').first()) as
      | { preferences: Record<string, unknown> | null }
      | undefined;
    const merged = { ...(existing?.preferences ?? {}), ...parse.data };
    await db('users')
      .where({ id: req.auth.userId })
      .update({ preferences: JSON.stringify(merged), updated_at: db.fn.now() });
    res.json({ ok: true, preferences: merged });
  } catch (err) {
    safeError('PATCH /settings/preferences failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET /settings/sessions, active sessions for this user
router.get('/sessions', async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new SessionRepository(db);
    const sessions = await repo.listActiveByUser(req.auth.userId, new Date().toISOString());
    res.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        current: s.id === req.auth.sessionId,
        userAgent: s.userAgent ?? null,
        ipAddress: s.ipAddress ?? null,
        createdAt: s.createdAt ?? null,
        expiresAt: s.expiresAt,
      })),
    });
  } catch (err) {
    safeError('GET /settings/sessions failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST /settings/sessions/revoke-others, sign out everywhere else
router.post('/sessions/revoke-others', async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new SessionRepository(db);
    const exceptId = req.auth.sessionId ?? '00000000-0000-0000-0000-000000000000';
    const revoked = await repo.revokeAllForUserExcept(req.auth.userId, exceptId, new Date().toISOString());
    res.json({ ok: true, revoked });
  } catch (err) {
    safeError('POST /settings/sessions/revoke-others failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// DELETE /settings/sessions/:id, revoke one of this user's sessions
router.delete('/sessions/:id', async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new SessionRepository(db);
    // Ownership check: only revoke a session that belongs to this user.
    const owned = await db('sessions').where({ id: String(req.params.id), user_id: req.auth.userId }).first();
    if (!owned) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }
    await repo.revokeById(String(req.params.id), new Date().toISOString());
    res.json({ ok: true });
  } catch (err) {
    safeError('DELETE /settings/sessions/:id failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST /settings/2fa/setup, generate a pending TOTP secret + QR
router.post('/2fa/setup', async (req, res) => {
  try {
    const db = req.app.get('db');
    const row = (await db('users').where({ id: req.auth.userId }).select('email', 'totp_enabled').first()) as
      | { email: string; totp_enabled: boolean }
      | undefined;
    if (!row) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    if (row.totp_enabled) {
      res.status(409).json({ message: 'Two-factor authentication is already enabled' });
      return;
    }
    const secret = generateSecret();
    const otpauthUri = generateURI({ issuer: TOTP_ISSUER, label: row.email, secret });
    const qrDataUrl = await QRCode.toDataURL(otpauthUri);
    // Store the pending secret; it only takes effect once verified via /2fa/enable.
    await db('users').where({ id: req.auth.userId }).update({ totp_secret: secret, updated_at: db.fn.now() });
    res.json({ secret, otpauthUri, qrDataUrl });
  } catch (err) {
    safeError('POST /settings/2fa/setup failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST /settings/2fa/enable, verify a code, enable 2FA, return backup codes once
router.post('/2fa/enable', async (req, res) => {
  const parse = z.object({ token: z.string().min(6).max(10) }).safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: 'A 6-digit code is required' });
    return;
  }
  try {
    const db = req.app.get('db');
    const row = (await db('users').where({ id: req.auth.userId }).select('totp_secret', 'totp_enabled').first()) as
      | { totp_secret: string | null; totp_enabled: boolean }
      | undefined;
    if (!row?.totp_secret) {
      res.status(400).json({ message: 'Start setup first' });
      return;
    }
    const { valid } = verifySync({ token: parse.data.token.replace(/\s/g, ''), secret: row.totp_secret });
    if (!valid) {
      res.status(400).json({ message: 'That code is incorrect or expired. Try again.' });
      return;
    }
    const backupCodes = generateBackupCodes();
    const hashed = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));
    await db('users')
      .where({ id: req.auth.userId })
      .update({ totp_enabled: true, totp_backup_codes: JSON.stringify(hashed), updated_at: db.fn.now() });
    res.json({ ok: true, backupCodes });
  } catch (err) {
    safeError('POST /settings/2fa/enable failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST /settings/2fa/disable, requires current password
router.post('/2fa/disable', async (req, res) => {
  const parse = z.object({ password: z.string().min(1) }).safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: 'Password is required' });
    return;
  }
  try {
    const db = req.app.get('db');
    const row = (await db('users').where({ id: req.auth.userId }).select('password_hash').first()) as
      | { password_hash: string }
      | undefined;
    if (!row) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const matches = await bcrypt.compare(parse.data.password, row.password_hash);
    if (!matches) {
      res.status(401).json({ message: 'Password is incorrect' });
      return;
    }
    await db('users')
      .where({ id: req.auth.userId })
      .update({ totp_enabled: false, totp_secret: null, totp_backup_codes: null, updated_at: db.fn.now() });
    res.json({ ok: true });
  } catch (err) {
    safeError('POST /settings/2fa/disable failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET /settings/export, machine-readable export of the user's own data
router.get('/export', async (req, res) => {
  try {
    const db = req.app.get('db');
    const user = (await db('users')
      .where({ id: req.auth.userId })
      .select('id', 'email', 'role', 'first_name', 'last_name', 'phone', 'created_at', 'caregiver_id')
      .first()) as Record<string, unknown> | undefined;
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const sessions = await new SessionRepository(db).listActiveByUser(req.auth.userId, new Date().toISOString());

    let training: unknown[] = [];
    const caregiverId = (user.caregiver_id as string | null) ?? null;
    if (caregiverId) {
      training = await db('course_enrollments as e')
        .join('learning_courses as c', 'c.id', 'e.course_id')
        .where('e.caregiver_id', caregiverId)
        .select('c.code as courseCode', 'c.title as courseTitle', 'e.status', 'e.last_completed_at', 'e.expires_at');
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name ?? null,
        lastName: user.last_name ?? null,
        phone: user.phone ?? null,
        memberSince: user.created_at ?? null,
      },
      activeSessions: sessions.length,
      training,
    };

    res.setHeader('Content-Disposition', 'attachment; filename="rayhealth-data-export.json"');
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(exportPayload, null, 2));
  } catch (err) {
    safeError('GET /settings/export failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST /settings/account/delete-request, record a deletion request
router.post('/account/delete-request', async (req, res) => {
  try {
    const db = req.app.get('db');
    await db('users').where({ id: req.auth.userId }).update({ deletion_requested_at: db.fn.now() });
    res.json({ ok: true });
  } catch (err) {
    safeError('POST /settings/account/delete-request failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// DELETE /settings/account/delete-request, cancel a pending deletion request
router.delete('/account/delete-request', async (req, res) => {
  try {
    const db = req.app.get('db');
    await db('users').where({ id: req.auth.userId }).update({ deletion_requested_at: null });
    res.json({ ok: true });
  } catch (err) {
    safeError('DELETE /settings/account/delete-request failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
