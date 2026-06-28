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

import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Knex } from 'knex';
import { z } from 'zod';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import {
  AuditEventRepository,
  PlatformAdminRepository,
  PlatformCredentialRepository,
  SUPER_ADMIN_ACTOR_ID,
  type AgencyReviewStatus,
} from '@rayhealth/core';
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

// ── WebAuthn (Face ID / device biometric) 2FA config ──────────────────────────
// RP ID must equal the site's registrable domain; origin is the full URL the
// browser shows. Defaults target production; override per-env for previews/dev.
const RP_ID = process.env.WEBAUTHN_RP_ID || 'rayhealthevv.com';
const RP_ORIGIN = process.env.WEBAUTHN_ORIGIN || 'https://rayhealthevv.com';
const RP_NAME = 'RayHealth Platform';

const b64uToBytes = (s: string): Uint8Array<ArrayBuffer> => {
  const buf = Buffer.from(s, 'base64url');
  const out = new Uint8Array(buf.length);
  out.set(buf);
  return out;
};
const bytesToB64u = (b: Uint8Array): string => Buffer.from(b).toString('base64url');
const strToBytes = (s: string): Uint8Array<ArrayBuffer> => {
  const buf = Buffer.from(s);
  const out = new Uint8Array(buf.length);
  out.set(buf);
  return out;
};

/** Sign a short-lived intermediate token that carries the WebAuthn challenge. */
function signStageToken(
  scope: 'platform-enroll' | 'platform-2fa',
  username: string,
  challenge: string,
  secret: string,
): string {
  return jwt.sign({ scope, username, challenge }, secret, { expiresIn: '10m', algorithm: 'HS256' });
}

/** Verify an intermediate stage token and return its payload, or null. */
function readStageToken(
  token: string,
  scope: 'platform-enroll' | 'platform-2fa',
  secret: string,
): { username: string; challenge: string } | null {
  try {
    const p = jwt.verify(token, secret, { algorithms: ['HS256'] }) as {
      scope: string;
      username: string;
      challenge: string;
    };
    return p.scope === scope ? { username: p.username, challenge: p.challenge } : null;
  } catch {
    return null;
  }
}

/** The full platform token issued only after the second factor succeeds. */
function signPlatformToken(username: string, secret: string): string {
  return jwt.sign({ sub: 'platform-superadmin', scope: 'platform', username }, secret, {
    expiresIn: '2h',
    algorithm: 'HS256',
  });
}

// ---------- Login (no auth) ----------

router.post('/login', async (req: Request, res: Response) => {
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

  // Password is factor #1. Factor #2 is a WebAuthn device biometric (Face ID /
  // Windows Hello). The full platform token is issued ONLY after the WebAuthn
  // ceremony succeeds. If no device is enrolled yet, return enrollment options
  // so the super-admin registers one now (bootstrap).
  try {
    const db = req.app.get('db') as Knex;
    const credRepo = new PlatformCredentialRepository(db);
    const creds = await credRepo.listByUsername(username);

    if (creds.length === 0) {
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userName: username,
        userID: strToBytes(username),
        attestationType: 'none',
        authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
      });
      const stageToken = signStageToken('platform-enroll', username, options.challenge, secret);
      res.json({ stage: 'enroll', stageToken, options });
      return;
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'required',
      allowCredentials: creds.map((c) => ({
        id: c.credentialId,
        transports: c.transports as never,
      })),
    });
    const stageToken = signStageToken('platform-2fa', username, options.challenge, secret);
    res.json({ stage: '2fa', stageToken, options });
  } catch (err) {
    safeError('platform login WebAuthn options failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ---------- WebAuthn enrollment (register a device biometric) ----------

const verifySchema = z.object({
  stageToken: z.string().min(1),
  response: z.record(z.string(), z.unknown()),
  deviceLabel: z.string().max(120).optional(),
});

router.post('/webauthn/register/verify', async (req: Request, res: Response) => {
  const parsed = verifySchema.safeParse(req.body ?? {});
  const secret = process.env.JWT_SECRET;
  if (!parsed.success || !secret) {
    res.status(400).json({ message: 'stageToken and response are required' });
    return;
  }
  const stage = readStageToken(parsed.data.stageToken, 'platform-enroll', secret);
  if (!stage) {
    res.status(401).json({ message: 'Enrollment session expired. Sign in again.' });
    return;
  }
  try {
    const verification = await verifyRegistrationResponse({
      response: parsed.data.response as never,
      expectedChallenge: stage.challenge,
      expectedOrigin: RP_ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ message: 'Device registration could not be verified' });
      return;
    }
    const { credential } = verification.registrationInfo;
    await new PlatformCredentialRepository(req.app.get('db') as Knex).add({
      username: stage.username,
      credentialId: credential.id,
      publicKey: bytesToB64u(credential.publicKey),
      counter: credential.counter,
      transports: (credential.transports as string[] | undefined) ?? [],
      deviceLabel: parsed.data.deviceLabel ?? null,
    });
    res.json({ token: signPlatformToken(stage.username, secret), username: stage.username });
  } catch (err) {
    safeError('webauthn register verify failed', err);
    res.status(400).json({ message: 'Device registration failed' });
  }
});

// ---------- WebAuthn authentication (second factor at login) ----------

router.post('/webauthn/authenticate/verify', async (req: Request, res: Response) => {
  const parsed = verifySchema.safeParse(req.body ?? {});
  const secret = process.env.JWT_SECRET;
  if (!parsed.success || !secret) {
    res.status(400).json({ message: 'stageToken and response are required' });
    return;
  }
  const stage = readStageToken(parsed.data.stageToken, 'platform-2fa', secret);
  if (!stage) {
    res.status(401).json({ message: 'Login session expired. Sign in again.' });
    return;
  }
  try {
    const db = req.app.get('db') as Knex;
    const credRepo = new PlatformCredentialRepository(db);
    const response = parsed.data.response as { id?: string };
    const credId = typeof response.id === 'string' ? response.id : '';
    const stored = await credRepo.findByCredentialId(credId);
    if (!stored || stored.username !== stage.username) {
      res.status(401).json({ message: 'Unrecognized device' });
      return;
    }
    const verification = await verifyAuthenticationResponse({
      response: parsed.data.response as never,
      expectedChallenge: stage.challenge,
      expectedOrigin: RP_ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: stored.credentialId,
        publicKey: b64uToBytes(stored.publicKey),
        counter: stored.counter,
        transports: stored.transports as never,
      },
    });
    if (!verification.verified) {
      res.status(401).json({ message: 'Biometric verification failed' });
      return;
    }
    await credRepo.updateCounter(stored.credentialId, verification.authenticationInfo.newCounter);
    res.json({ token: signPlatformToken(stage.username, secret), username: stage.username });
  } catch (err) {
    safeError('webauthn authenticate verify failed', err);
    res.status(401).json({ message: 'Biometric verification failed' });
  }
});

// ---------- Everything below requires a platform token ----------

router.use(requirePlatformAdmin);

// Enroll an ADDITIONAL device while already signed in (e.g. a backup phone).
router.post('/webauthn/register/options', async (req: Request, res: Response) => {
  const secret = process.env.JWT_SECRET!;
  const username = req.platformAdmin?.username ?? process.env.SUPER_ADMIN_USERNAME ?? 'superadmin';
  try {
    const creds = await new PlatformCredentialRepository(req.app.get('db') as Knex).listByUsername(username);
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: username,
      userID: strToBytes(username),
      attestationType: 'none',
      authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
      excludeCredentials: creds.map((c) => ({ id: c.credentialId, transports: c.transports as never })),
    });
    res.json({ stageToken: signStageToken('platform-enroll', username, options.challenge, secret), options });
  } catch (err) {
    safeError('webauthn register options failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/webauthn/credentials', async (req: Request, res: Response) => {
  const username = req.platformAdmin?.username ?? process.env.SUPER_ADMIN_USERNAME ?? 'superadmin';
  try {
    const creds = await new PlatformCredentialRepository(req.app.get('db') as Knex).listByUsername(username);
    res.json(creds.map((c) => ({ id: c.id, deviceLabel: c.deviceLabel })));
  } catch (err) {
    safeError('webauthn list credentials failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.delete('/webauthn/credentials/:id', async (req: Request, res: Response) => {
  const username = req.platformAdmin?.username ?? process.env.SUPER_ADMIN_USERNAME ?? 'superadmin';
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  try {
    const ok = await new PlatformCredentialRepository(req.app.get('db') as Knex).remove(id, username);
    if (!ok) {
      res.status(404).json({ message: 'credential not found' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    safeError('webauthn remove credential failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

async function audit(
  db: Knex,
  eventType: 'agency.review.approved' | 'agency.review.rejected' | 'account.suspended' | 'account.reactivated',
  agencyId: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
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
  } catch (err) {
    safeError(`Failed to audit ${eventType}`, err);
  }
}

router.get('/agencies', async (req: Request, res: Response) => {
  try {
    const agencies = await new PlatformAdminRepository(req.app.get('db') as Knex).listAgencies();
    res.json(agencies);
  } catch (err) {
    safeError('superadmin list agencies failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

async function reviewAgency(req: Request, res: Response, status: AgencyReviewStatus): Promise<void> {
  const parsed = reviewSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: 'notes must be a string under 2000 chars' });
    return;
  }
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const reviewer = req.platformAdmin?.username ?? 'superadmin';
  try {
    const db = req.app.get('db') as Knex;
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
    await audit(
      db,
      status === 'approved' ? 'agency.review.approved' : 'agency.review.rejected',
      id,
      'agency',
      id,
      { agencyName: updated.name, reviewer, notes: parsed.data.notes ?? null },
    );
    res.json({ id, reviewStatus: status });
  } catch (err) {
    safeError('superadmin review agency failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

router.post('/agencies/:id/approve', (req, res) => reviewAgency(req, res, 'approved'));
router.post('/agencies/:id/reject', (req, res) => reviewAgency(req, res, 'rejected'));

router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await new PlatformAdminRepository(req.app.get('db') as Knex).listUsers();
    res.json(users);
  } catch (err) {
    safeError('superadmin list users failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

async function setSuspended(req: Request, res: Response, suspended: boolean): Promise<void> {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  try {
    const db = req.app.get('db') as Knex;
    const result = await new PlatformAdminRepository(db).setUserSuspended(id, suspended);
    if (!result) {
      res.status(404).json({ message: 'user not found' });
      return;
    }
    await audit(
      db,
      suspended ? 'account.suspended' : 'account.reactivated',
      result.agencyId,
      'user',
      id,
      { email: result.email, by: req.platformAdmin?.username ?? 'superadmin' },
    );
    res.json({ id, suspended });
  } catch (err) {
    safeError('superadmin set-suspended failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

router.post('/users/:id/suspend', (req, res) => setSuspended(req, res, true));
router.post('/users/:id/reactivate', (req, res) => setSuspended(req, res, false));

export default router;
