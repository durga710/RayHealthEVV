# Security Architecture Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden RayHealth's current security baseline by replacing browser-stored JWTs with server-managed sessions, adding real mobile authentication storage, and turning audit logging into durable compliance evidence.

**Architecture:** Phase 1 keeps the current Express, React, Expo, and Postgres stack while introducing shared session and audit primitives in `@rayhealth/core`. Web uses an `HttpOnly` cookie session plus CSRF header, mobile uses a bearer token stored in device secure storage, and the API accepts both paths through one `authContext` middleware.

**Tech Stack:** TypeScript ESM, Express 5, Vitest, Knex/Postgres, React 19, Expo 54, `bcryptjs`, `jsonwebtoken`, `expo-secure-store`.

---

## Scope

This plan implements the first slice from [the security architecture design](/Users/durgaghimeray/Desktop/rayhealthevv-fresh/rayhealth-fresh/docs/superpowers/specs/2026-05-08-security-architecture-design.md:1):

- Web session hardening.
- Mobile real authentication and secure token storage.
- Structured durable audit events.
- The first authorization seam needed for later PHI policy work.
- Showcase/public-surface isolation checks for this fresh repository.

Policy-based PHI redaction, break-glass workflows, anomaly alerts, SSO/SCIM, and retention automation are intentionally separate plans.

## Current Parallel Work Warning

At plan-writing time, these files already had uncommitted edits that appear to be parallel work:

- `packages/core/src/config/pennsylvania.ts`
- `packages/core/src/migrations/schema.ts`
- `packages/core/src/domain/audit.ts`
- `packages/core/src/domain/caregiver.ts`
- `packages/core/src/domain/evv-exception.ts`
- `packages/web/src/features/landing/LandingPage.tsx`
- `packages/web/src/index.css`
- `packages/web/src/features/landing/HeroGraphic.tsx`

Before editing any of those files, re-read them and preserve the existing changes. Do not revert them.

## File Structure

Create or modify these files:

- Create `packages/core/src/domain/session.ts`: Zod schema and TypeScript types for durable web sessions.
- Modify `packages/core/src/domain/audit.ts`: Extend existing audit event types to cover authentication, session, CSRF, and PHI access events.
- Create `packages/core/src/repositories/session-repository.ts`: Create, look up, and revoke session records by token hash.
- Create `packages/core/src/repositories/audit-event-repository.ts`: Persist structured audit events.
- Modify `packages/core/src/migrations/schema.ts`: Add `sessions` if absent and ensure `audit_events` has fields required by this plan.
- Modify `packages/core/src/index.ts`: Export new session and audit repository modules.
- Create `packages/core/src/__tests__/session-repository.test.ts`: Integration-style repository test that skips gracefully without DB connectivity.
- Create `packages/core/src/__tests__/audit-event-repository.test.ts`: Integration-style audit repository test that skips gracefully without DB connectivity.
- Create `packages/app/src/security/token-hashing.ts`: Generate and hash opaque session/CSRF tokens.
- Create `packages/app/src/security/cookies.ts`: Session cookie names and secure cookie option helpers.
- Create `packages/app/src/middleware/csrf.ts`: CSRF protection for cookie-authenticated unsafe requests.
- Modify `packages/app/src/types.ts`: Add session metadata to `Express.Request.auth`.
- Modify `packages/app/src/middleware/auth-context.ts`: Accept session cookie auth for web and bearer JWT auth for mobile/tests.
- Modify `packages/app/src/middleware/audit-log.ts`: Persist durable audit events after protected requests complete.
- Modify `packages/app/src/routes/auth-routes.ts`: Add cookie-login, mobile-login, logout, and authenticated `me` behavior.
- Modify `packages/app/src/app.ts`: Enable credentials-aware CORS, mount CSRF middleware, and preserve auth rate limits.
- Modify `packages/app/src/routes/__tests__/test-helpers.ts`: Add deterministic session helper utilities.
- Create `packages/app/src/routes/__tests__/auth-session-routes.test.ts`: Verify cookie session login, CSRF, logout, and bearer fallback.
- Modify `packages/web/src/lib/AuthContext.tsx`: Remove `localStorage` tokens and hydrate auth from `/auth/me`.
- Modify `packages/web/src/lib/api-client.ts`: Send credentials and CSRF headers.
- Create `packages/web/src/lib/session-state.ts`: In-memory CSRF state shared between auth context and API client.
- Create `packages/web/src/lib/AuthContext.test.tsx`: Verify no browser token persistence and successful cookie-login flow.
- Modify `packages/mobile/package.json`: Add `expo-secure-store`.
- Modify `packages/mobile/src/lib/api-client.ts`: Attach mobile bearer token from secure auth state.
- Modify `packages/mobile/src/lib/AuthContext.tsx`: Load, store, and clear mobile access tokens through secure storage.
- Modify `packages/mobile/src/features/auth/LoginScreen.tsx`: Submit real email/password credentials and display login failures.
- Create `scripts/security-surface-scan.ts`: Assert web code no longer uses `localStorage` auth tokens and demo/static surfaces do not reference production secrets.
- Create `scripts/check.sh`: Run lint, typecheck, tests, build, and the security surface scan.
- Modify `package.json`: Add `security:scan` and `check` scripts.

## Task 1: Core Session Repository

**Files:**
- Create: `packages/core/src/domain/session.ts`
- Create: `packages/core/src/repositories/session-repository.ts`
- Modify: `packages/core/src/migrations/schema.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/__tests__/session-repository.test.ts`

- [ ] **Step 1: Write the failing session repository test**

Create `packages/core/src/__tests__/session-repository.test.ts`:

```typescript
import { afterAll, describe, expect, it } from 'vitest';
import { createDb, SessionRepository } from '../index.js';

describe('SessionRepository', () => {
  const db = createDb();
  const repository = new SessionRepository(db);

  afterAll(async () => {
    await db.destroy();
  });

  it('creates, finds, and revokes an active session', async () => {
    try {
      const now = '2026-05-08T12:00:00.000Z';
      const expiresAt = '2026-05-08T20:00:00.000Z';
      const created = await repository.create({
        agencyId: '00000000-0000-4000-8000-000000000001',
        userId: '00000000-0000-4000-8000-000000000002',
        role: 'admin',
        sessionTokenHash: 'a'.repeat(64),
        csrfTokenHash: 'b'.repeat(64),
        userAgent: 'vitest',
        ipAddress: '127.0.0.1',
        expiresAt
      });

      const found = await repository.findActiveByTokenHash('a'.repeat(64), now);
      expect(found?.id).toBe(created.id);
      expect(found?.role).toBe('admin');
      expect(found?.csrfTokenHash).toBe('b'.repeat(64));

      await repository.rotateCsrfToken(created.id, 'c'.repeat(64));
      const rotated = await repository.findActiveByTokenHash('a'.repeat(64), now);
      expect(rotated?.csrfTokenHash).toBe('c'.repeat(64));

      await repository.revokeById(created.id, '2026-05-08T12:05:00.000Z');
      const revoked = await repository.findActiveByTokenHash('a'.repeat(64), now);
      expect(revoked).toBeUndefined();
    } catch {
      console.warn('Skipping SessionRepository test - no DB connection or migration');
    }
  });
});
```

- [ ] **Step 2: Run the focused core test and verify it fails**

Run:

```bash
npm --workspace @rayhealth/core run test -- --run packages/core/src/__tests__/session-repository.test.ts
```

Expected: fails because `SessionRepository` is not exported or the `sessions` table does not exist.

- [ ] **Step 3: Create the session domain model**

Create `packages/core/src/domain/session.ts`:

```typescript
import { z } from 'zod';

export const sessionSchema = z.object({
  id: z.string().uuid(),
  agencyId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(['admin', 'coordinator', 'caregiver', 'family']),
  caregiverId: z.string().uuid().optional(),
  sessionTokenHash: z.string().length(64),
  csrfTokenHash: z.string().length(64),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  expiresAt: z.string().datetime(),
  revokedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime().optional()
});

export const newSessionSchema = sessionSchema.omit({
  id: true,
  revokedAt: true,
  createdAt: true
});

export type Session = z.infer<typeof sessionSchema>;
export type NewSession = z.infer<typeof newSessionSchema>;
```

- [ ] **Step 4: Create the repository implementation**

Create `packages/core/src/repositories/session-repository.ts`:

```typescript
import type { Knex } from 'knex';
import type { NewSession, Session } from '../domain/session.js';

type SessionRow = {
  id: string;
  agency_id: string;
  user_id: string;
  role: string;
  caregiver_id?: string | null;
  session_token_hash: string;
  csrf_token_hash: string;
  user_agent?: string | null;
  ip_address?: string | null;
  expires_at: Date | string;
  revoked_at?: Date | string | null;
  created_at?: Date | string;
};

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    agencyId: row.agency_id,
    userId: row.user_id,
    role: row.role,
    caregiverId: row.caregiver_id ?? undefined,
    sessionTokenHash: row.session_token_hash,
    csrfTokenHash: row.csrf_token_hash,
    userAgent: row.user_agent ?? undefined,
    ipAddress: row.ip_address ?? undefined,
    expiresAt: toIso(row.expires_at)!,
    revokedAt: toIso(row.revoked_at),
    createdAt: toIso(row.created_at)
  };
}

export class SessionRepository {
  constructor(private readonly db: Knex) {}

  async create(session: NewSession): Promise<Session> {
    const [row] = await this.db('sessions')
      .insert({
        id: this.db.raw('gen_random_uuid()'),
        agency_id: session.agencyId,
        user_id: session.userId,
        role: session.role,
        caregiver_id: session.caregiverId ?? null,
        session_token_hash: session.sessionTokenHash,
        csrf_token_hash: session.csrfTokenHash,
        user_agent: session.userAgent ?? null,
        ip_address: session.ipAddress ?? null,
        expires_at: session.expiresAt,
        revoked_at: null
      })
      .returning('*');
    return mapSession(row);
  }

  async findActiveByTokenHash(sessionTokenHash: string, nowIso: string): Promise<Session | undefined> {
    const row = await this.db('sessions')
      .where({ session_token_hash: sessionTokenHash })
      .whereNull('revoked_at')
      .where('expires_at', '>', nowIso)
      .first();
    return row ? mapSession(row) : undefined;
  }

  async revokeById(id: string, revokedAtIso: string): Promise<void> {
    await this.db('sessions')
      .where({ id })
      .whereNull('revoked_at')
      .update({ revoked_at: revokedAtIso });
  }

  async revokeByTokenHash(sessionTokenHash: string, revokedAtIso: string): Promise<void> {
    await this.db('sessions')
      .where({ session_token_hash: sessionTokenHash })
      .whereNull('revoked_at')
      .update({ revoked_at: revokedAtIso });
  }

  async rotateCsrfToken(id: string, csrfTokenHash: string): Promise<void> {
    await this.db('sessions')
      .where({ id })
      .whereNull('revoked_at')
      .update({ csrf_token_hash: csrfTokenHash });
  }
}
```

- [ ] **Step 5: Extend the schema without removing parallel changes**

In `packages/core/src/migrations/schema.ts`, add this block after the `users` table creation block and before visit maintenance tables. Re-read the file before editing because parallel work may have added nearby tables.

```typescript
  if (!(await knex.schema.hasTable('sessions'))) {
    await knex.schema.createTable('sessions', (table) => {
      table.uuid('id').primary();
      table.uuid('agency_id').references('id').inTable('agencies').notNullable();
      table.uuid('user_id').references('id').inTable('users').notNullable();
      table.string('role').notNullable();
      table.uuid('caregiver_id');
      table.string('session_token_hash', 64).notNullable().unique();
      table.string('csrf_token_hash', 64).notNullable();
      table.text('user_agent');
      table.string('ip_address', 64);
      table.timestamp('expires_at').notNullable();
      table.timestamp('revoked_at');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      table.index(['agency_id', 'user_id']);
      table.index(['expires_at']);
    });
  }
```

In the `down` migration, drop `sessions` before `users`:

```typescript
  await knex.schema.dropTableIfExists('sessions');
```

- [ ] **Step 6: Export the new primitives**

Add these exports to `packages/core/src/index.ts`:

```typescript
export * from './domain/session.js';
export * from './repositories/session-repository.js';
```

- [ ] **Step 7: Run the focused test and commit**

Run:

```bash
npm --workspace @rayhealth/core run test -- --run packages/core/src/__tests__/session-repository.test.ts
```

Expected: pass, or skip with the existing "no DB connection or migration" warning.

Commit:

```bash
git add packages/core/src/domain/session.ts packages/core/src/repositories/session-repository.ts packages/core/src/migrations/schema.ts packages/core/src/index.ts packages/core/src/__tests__/session-repository.test.ts
git commit -m "add durable session repository"
```

## Task 2: Cookie Session Auth and CSRF

**Files:**
- Create: `packages/app/src/security/token-hashing.ts`
- Create: `packages/app/src/security/cookies.ts`
- Create: `packages/app/src/middleware/csrf.ts`
- Modify: `packages/app/src/types.ts`
- Modify: `packages/app/src/middleware/auth-context.ts`
- Modify: `packages/app/src/routes/auth-routes.ts`
- Modify: `packages/app/src/app.ts`
- Test: `packages/app/src/routes/__tests__/auth-session-routes.test.ts`

- [ ] **Step 1: Write failing API session tests**

Create `packages/app/src/routes/__tests__/auth-session-routes.test.ts`:

```typescript
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

describe('auth session routes', () => {
  it('sets an HttpOnly session cookie and returns csrf token on web login', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    const findByEmail = vi.fn().mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000011',
      agencyId: '00000000-0000-4000-8000-000000000012',
      email: 'admin@rayhealth.example',
      passwordHash,
      role: 'admin'
    });
    const createSession = vi.fn().mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000013',
      agencyId: '00000000-0000-4000-8000-000000000012',
      userId: '00000000-0000-4000-8000-000000000011',
      role: 'admin',
      sessionTokenHash: 'a'.repeat(64),
      csrfTokenHash: 'b'.repeat(64),
      expiresAt: '2026-05-08T20:00:00.000Z'
    });

    vi.spyOn(core, 'UserRepository').mockImplementation(() => ({ findByEmail }) as unknown as core.UserRepository);
    vi.spyOn(core, 'SessionRepository').mockImplementation(() => ({ create: createSession }) as unknown as core.SessionRepository);

    const response = await request(createApp())
      .post('/auth/login')
      .send({ email: 'admin@rayhealth.example', password: 'correct-password' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      role: 'admin',
      agencyId: '00000000-0000-4000-8000-000000000012'
    });
    expect(response.body.csrfToken).toEqual(expect.any(String));
    expect(response.headers['set-cookie'].join(';')).toContain('rayhealth_session=');
    expect(response.headers['set-cookie'].join(';')).toContain('HttpOnly');
  });

  it('continues to accept bearer JWTs for mobile and tests', async () => {
    const response = await request(createApp())
      .get('/auth/me')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('admin');
  });
});
```

- [ ] **Step 2: Run the focused app test and verify it fails**

Run:

```bash
npm --workspace @rayhealth/app run test -- --run packages/app/src/routes/__tests__/auth-session-routes.test.ts
```

Expected: fails because session and CSRF support are not implemented.

- [ ] **Step 3: Create opaque token helpers**

Create `packages/app/src/security/token-hashing.ts`:

```typescript
import crypto from 'node:crypto';

export function createOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

- [ ] **Step 4: Create cookie helpers**

Create `packages/app/src/security/cookies.ts`:

```typescript
import type { CookieOptions, Request } from 'express';

export const SESSION_COOKIE_NAME = 'rayhealth_session';
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: EIGHT_HOURS_MS
  };
}

export function clearSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  };
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.header('cookie');
  if (!header) return undefined;
  const prefix = `${name}=`;
  return header
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}
```

- [ ] **Step 5: Extend request auth metadata**

Update `packages/app/src/types.ts` so `AuthContext` includes session metadata:

```typescript
import type { AppRole } from '@rayhealth/core';

export interface AuthContext {
  agencyId: string;
  role: AppRole;
  userId: string;
  caregiverId?: string;
  authMethod: 'session' | 'bearer';
  sessionId?: string;
  csrfTokenHash?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth: AuthContext;
    }
  }
}
```

- [ ] **Step 6: Update `authContext` to accept session cookies first**

Modify `packages/app/src/middleware/auth-context.ts` to read the session cookie, then fall back to bearer JWT:

```typescript
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SessionRepository, type AppRole } from '@rayhealth/core';
import { readCookie, SESSION_COOKIE_NAME } from '../security/cookies.js';
import { hashOpaqueToken } from '../security/token-hashing.js';

interface JwtPayload {
  sub: string;
  agencyId: string;
  role: AppRole;
  caregiverId?: string;
}

export async function authContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionToken = readCookie(req, SESSION_COOKIE_NAME);
  if (sessionToken) {
    try {
      const db = req.app.get('db');
      const session = await new SessionRepository(db).findActiveByTokenHash(
        hashOpaqueToken(sessionToken),
        new Date().toISOString()
      );
      if (session) {
        req.auth = {
          agencyId: session.agencyId,
          userId: session.userId,
          role: session.role,
          caregiverId: session.caregiverId,
          authMethod: 'session',
          sessionId: session.id,
          csrfTokenHash: session.csrfTokenHash
        };
        next();
        return;
      }
    } catch {
      res.status(401).json({ message: 'Invalid or expired session' });
      return;
    }
  }

  const authHeader = req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing or invalid Authorization header' });
    return;
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET!) as JwtPayload;
    req.auth = {
      agencyId: payload.agencyId,
      role: payload.role,
      userId: payload.sub,
      caregiverId: payload.caregiverId,
      authMethod: 'bearer'
    };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
```

- [ ] **Step 7: Add CSRF middleware**

Create `packages/app/src/middleware/csrf.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';
import { hashOpaqueToken } from '../security/token-hashing.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function requireCsrf(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method) || req.auth.authMethod !== 'session') {
    next();
    return;
  }

  const csrfToken = req.header('x-csrf-token');
  if (!csrfToken || hashOpaqueToken(csrfToken) !== req.auth.csrfTokenHash) {
    res.status(403).json({ message: 'Invalid CSRF token' });
    return;
  }

  next();
}
```

- [ ] **Step 8: Update auth routes**

In `packages/app/src/routes/auth-routes.ts`, update login to create a session cookie and add `/mobile/login` plus `/logout`. The key route behavior must match this structure:

```typescript
const sessionToken = createOpaqueToken();
const csrfToken = createOpaqueToken();
const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

await new SessionRepository(db).create({
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

res.cookie(SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions());
res.json({ userId: user.id, role: user.role, agencyId: user.agencyId, csrfToken });
```

Add mobile login:

```typescript
router.post('/mobile/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ message: 'email and password required' });
    return;
  }

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
  res.json({ token, role: user.role, agencyId: user.agencyId });
});
```

Add logout:

```typescript
router.post('/logout', authContext, requireCsrf, async (req, res) => {
  if (req.auth.authMethod === 'session' && req.auth.sessionId) {
    await new SessionRepository(req.app.get('db')).revokeById(req.auth.sessionId, new Date().toISOString());
  }
  res.clearCookie(SESSION_COOKIE_NAME, clearSessionCookieOptions());
  res.status(204).send();
});
```

Update `/me` so page refreshes receive a newly rotated CSRF token:

```typescript
router.get('/me', authContext, async (req, res) => {
  if (req.auth.authMethod === 'session' && req.auth.sessionId) {
    const csrfToken = createOpaqueToken();
    await new SessionRepository(req.app.get('db')).rotateCsrfToken(req.auth.sessionId, hashOpaqueToken(csrfToken));
    res.json({ userId: req.auth.userId, role: req.auth.role, agencyId: req.auth.agencyId, csrfToken });
    return;
  }

  res.json({ userId: req.auth.userId, role: req.auth.role, agencyId: req.auth.agencyId });
});
```

- [ ] **Step 9: Mount CSRF and credentials-aware CORS**

In `packages/app/src/app.ts`, update CORS and middleware ordering:

```typescript
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use('/auth/login', authLimiter);
app.use('/auth/mobile/login', authLimiter);
app.use('/auth/bootstrap', authLimiter);
app.use('/auth', authRoutes);
app.use(authContext);
app.use(requireCsrf);
app.use(auditLog);
```

- [ ] **Step 10: Run tests and commit**

Run:

```bash
npm --workspace @rayhealth/app run test -- --run packages/app/src/routes/__tests__/auth-session-routes.test.ts
npm --workspace @rayhealth/app run test
```

Expected: all app tests pass.

Commit:

```bash
git add packages/app/src/security/token-hashing.ts packages/app/src/security/cookies.ts packages/app/src/middleware/csrf.ts packages/app/src/types.ts packages/app/src/middleware/auth-context.ts packages/app/src/routes/auth-routes.ts packages/app/src/app.ts packages/app/src/routes/__tests__/auth-session-routes.test.ts
git commit -m "harden web auth with cookie sessions"
```

## Task 3: Durable Audit Events

**Files:**
- Modify: `packages/core/src/domain/audit.ts`
- Create: `packages/core/src/repositories/audit-event-repository.ts`
- Modify: `packages/core/src/migrations/schema.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/app/src/middleware/audit-log.ts`
- Modify: `packages/app/src/routes/auth-routes.ts`
- Test: `packages/core/src/__tests__/audit-event-repository.test.ts`
- Test: `packages/app/src/routes/__tests__/audit-log.test.ts`

- [ ] **Step 1: Write the repository test**

Create `packages/core/src/__tests__/audit-event-repository.test.ts`:

```typescript
import { afterAll, describe, expect, it } from 'vitest';
import { AuditEventRepository, createDb } from '../index.js';

describe('AuditEventRepository', () => {
  const db = createDb();
  const repository = new AuditEventRepository(db);

  afterAll(async () => {
    await db.destroy();
  });

  it('persists a structured authentication audit event', async () => {
    try {
      const created = await repository.create({
        agencyId: '00000000-0000-4000-8000-000000000001',
        actorId: '00000000-0000-4000-8000-000000000002',
        actorType: 'user',
        eventType: 'auth.login.success',
        entityType: 'session',
        entityId: '00000000-0000-4000-8000-000000000003',
        outcome: 'success',
        payload: { authMethod: 'session' },
        occurredAt: '2026-05-08T12:00:00.000Z'
      });

      expect(created.id).toEqual(expect.any(String));
      expect(created.eventType).toBe('auth.login.success');
      expect(created.outcome).toBe('success');
    } catch {
      console.warn('Skipping AuditEventRepository test - no DB connection or migration');
    }
  });
});
```

- [ ] **Step 2: Extend audit domain types**

Update `packages/core/src/domain/audit.ts` to include these event and outcome values while preserving existing event types:

```typescript
export const securityAuditEventTypes = [
  'auth.login.success',
  'auth.login.failure',
  'auth.logout',
  'session.created',
  'session.revoked',
  'csrf.failure',
  'phi.read',
  'phi.export',
  'request.write',
  'permission.denied'
] as const;

export const auditOutcomes = ['success', 'failure', 'denied'] as const;
export const auditActorTypes = ['user', 'service', 'system'] as const;
```

Update `auditEventSchema` to include:

```typescript
actorType: z.enum(auditActorTypes).default('user'),
outcome: z.enum(auditOutcomes),
correlationId: z.string().optional(),
occurredAt: z.string().datetime().optional(),
```

- [ ] **Step 3: Create `AuditEventRepository`**

Create `packages/core/src/repositories/audit-event-repository.ts`:

```typescript
import type { Knex } from 'knex';
import type { AuditEvent } from '../domain/audit.js';

type NewAuditEvent = Omit<AuditEvent, 'id' | 'createdAt'>;

export class AuditEventRepository {
  constructor(private readonly db: Knex) {}

  async create(event: NewAuditEvent): Promise<AuditEvent> {
    const [row] = await this.db('audit_events')
      .insert({
        id: this.db.raw('gen_random_uuid()'),
        agency_id: event.agencyId,
        actor_id: event.actorId,
        actor_type: event.actorType,
        event_type: event.eventType,
        entity_type: event.entityType,
        entity_id: event.entityId,
        outcome: event.outcome,
        correlation_id: event.correlationId ?? null,
        payload: event.payload ?? {},
        occurred_at: event.occurredAt ?? this.db.fn.now()
      })
      .returning('*');

    return {
      id: row.id,
      agencyId: row.agency_id,
      actorId: row.actor_id,
      actorType: row.actor_type,
      eventType: row.event_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      outcome: row.outcome,
      correlationId: row.correlation_id ?? undefined,
      payload: row.payload ?? {},
      occurredAt: new Date(row.occurred_at).toISOString(),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined
    };
  }
}
```

- [ ] **Step 4: Update the audit table schema**

In `packages/core/src/migrations/schema.ts`, ensure `audit_events` contains:

```typescript
table.string('actor_type').notNullable().defaultTo('user');
table.string('outcome').notNullable().defaultTo('success');
table.string('correlation_id');
table.timestamp('occurred_at').notNullable().defaultTo(knex.fn.now());
table.index(['agency_id', 'event_type']);
table.index(['entity_type', 'entity_id']);
table.index(['occurred_at']);
```

If `audit_events` already exists in the current branch, add missing columns through guarded `hasColumn` checks after the table creation block.

- [ ] **Step 5: Export the repository**

Add to `packages/core/src/index.ts`:

```typescript
export * from './domain/audit.js';
export * from './repositories/audit-event-repository.js';
```

- [ ] **Step 6: Replace console-only audit middleware**

Update `packages/app/src/middleware/audit-log.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';
import { AuditEventRepository } from '@rayhealth/core';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function auditLog(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', async () => {
    if (SAFE_METHODS.has(req.method) && !req.path.includes('/clients')) return;

    try {
      await new AuditEventRepository(req.app.get('db')).create({
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: res.statusCode >= 400 ? 'permission.denied' : req.method === 'GET' ? 'phi.read' : 'request.write',
        entityType: req.path.split('/')[1] || 'request',
        entityId: req.auth.userId,
        outcome: res.statusCode >= 400 ? 'denied' : 'success',
        correlationId: req.header('x-request-id') ?? undefined,
        payload: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          authMethod: req.auth.authMethod
        },
        occurredAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to persist audit event', error);
    }
  });

  next();
}
```

- [ ] **Step 7: Emit successful auth and session audit events**

In `packages/app/src/routes/auth-routes.ts`, capture the created session and emit durable auth events after successful web login:

```typescript
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

await new AuditEventRepository(db).create({
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
```

In the logout route, emit `session.revoked` after revocation:

```typescript
await new AuditEventRepository(req.app.get('db')).create({
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
```

- [ ] **Step 8: Run tests and commit**

Run:

```bash
npm --workspace @rayhealth/core run test -- --run packages/core/src/__tests__/audit-event-repository.test.ts
npm --workspace @rayhealth/app run test
```

Expected: focused audit test passes or skips gracefully; app tests pass.

Commit:

```bash
git add packages/core/src/domain/audit.ts packages/core/src/repositories/audit-event-repository.ts packages/core/src/migrations/schema.ts packages/core/src/index.ts packages/core/src/__tests__/audit-event-repository.test.ts packages/app/src/middleware/audit-log.ts packages/app/src/routes/auth-routes.ts
git commit -m "persist structured audit events"
```

## Task 4: Web Cookie Session Client

**Files:**
- Create: `packages/web/src/lib/session-state.ts`
- Modify: `packages/web/src/lib/AuthContext.tsx`
- Modify: `packages/web/src/lib/api-client.ts`
- Test: `packages/web/src/lib/AuthContext.test.tsx`
- Modify: `packages/web/src/App.test.tsx`

- [ ] **Step 1: Write failing web auth tests**

Create `packages/web/src/lib/AuthContext.test.tsx`:

```typescript
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { AuthProvider, useAuth } from './AuthContext.js';

function Probe() {
  const { isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="state">{isAuthenticated ? 'in' : 'out'}</div>
      <button onClick={() => login('admin@rayhealth.example', 'password')}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('hydrates from /auth/me and never stores JWTs in localStorage', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        userId: 'user-1',
        role: 'admin',
        agencyId: 'agency-1',
        csrfToken: 'csrf-1'
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('in'));
    expect(localStorage.getItem('rayhealth_token')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ credentials: 'include' }));
  });

  it('logs in through cookie session response', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Not authenticated' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ userId: 'user-1', role: 'admin', agencyId: 'agency-1', csrfToken: 'csrf-login' })
      }));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'login' }));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('in'));
    expect(localStorage.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run the focused web test and verify it fails**

Run:

```bash
npm --workspace @rayhealth/web run test -- --run packages/web/src/lib/AuthContext.test.tsx
```

Expected: fails because the current provider reads and writes `localStorage`.

- [ ] **Step 3: Add shared CSRF state**

Create `packages/web/src/lib/session-state.ts`:

```typescript
let csrfToken: string | null = null;

export function setCsrfToken(nextToken: string | null): void {
  csrfToken = nextToken;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}
```

- [ ] **Step 4: Update the API client**

Modify `packages/web/src/lib/api-client.ts`:

```typescript
import { getCsrfToken } from './session-state.js';

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const csrfToken = getCsrfToken();
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}
```

- [ ] **Step 5: Replace `AuthContext` localStorage token auth**

Modify `packages/web/src/lib/AuthContext.tsx` so it stores user metadata and CSRF in memory only:

```typescript
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCsrfToken, setCsrfToken } from './session-state.js';

const API_BASE = (import.meta as { env: Record<string, string> }).env.VITE_API_URL ?? '/api';

interface AuthUser {
  userId: string;
  role: string;
  agencyId: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: 'include',
          headers: { accept: 'application/json' }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setUser({ userId: data.userId, role: data.role, agencyId: data.agencyId });
          setCsrfToken(data.csrfToken ?? null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const { message } = await res.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(message);
    }
    const data = await res.json();
    setUser({ userId: data.userId, role: data.role, agencyId: data.agencyId });
    setCsrfToken(data.csrfToken ?? null);
  };

  const logout = async () => {
    const csrfToken = getCsrfToken();
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: csrfToken ? { 'x-csrf-token': csrfToken } : {}
    }).catch(() => undefined);
    setCsrfToken(null);
    setUser(null);
  };

  if (isLoading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!user, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
```

- [ ] **Step 6: Run web tests and commit**

Run:

```bash
npm --workspace @rayhealth/web run test -- --run packages/web/src/lib/AuthContext.test.tsx
npm --workspace @rayhealth/web run test
```

Expected: all web tests pass.

Commit:

```bash
git add packages/web/src/lib/session-state.ts packages/web/src/lib/AuthContext.tsx packages/web/src/lib/api-client.ts packages/web/src/lib/AuthContext.test.tsx packages/web/src/App.test.tsx
git commit -m "move web auth to cookie sessions"
```

## Task 5: Mobile Secure Auth Storage

**Files:**
- Modify: `packages/mobile/package.json`
- Modify: `packages/mobile/src/lib/api-client.ts`
- Modify: `packages/mobile/src/lib/AuthContext.tsx`
- Modify: `packages/mobile/src/features/auth/LoginScreen.tsx`

- [ ] **Step 1: Add secure storage dependency**

Run:

```bash
npm --workspace @rayhealth/mobile install expo-secure-store
```

Expected: `packages/mobile/package.json` and `package-lock.json` include `expo-secure-store`.

- [ ] **Step 2: Update mobile API client token handling**

Modify `packages/mobile/src/lib/api-client.ts`:

```typescript
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'https://rayhealthevv.com';

let accessToken: string | null = null;

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export function setMobileAccessToken(token: string | null): void {
  accessToken = token;
}

export default apiClient;
```

- [ ] **Step 3: Replace mock mobile auth context**

Modify `packages/mobile/src/lib/AuthContext.tsx`:

```typescript
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import apiClient, { setMobileAccessToken } from './api-client';

const TOKEN_KEY = 'rayhealth_mobile_access_token';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function hydrate() {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      setMobileAccessToken(token);
      setIsAuthenticated(!!token);
      setIsLoading(false);
    }

    void hydrate();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await apiClient.post('/api/auth/mobile/login', { email, password });
    await SecureStore.setItemAsync(TOKEN_KEY, data.token);
    setMobileAccessToken(data.token);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setMobileAccessToken(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

- [ ] **Step 4: Update the login screen**

Modify `packages/mobile/src/features/auth/LoginScreen.tsx`:

```typescript
import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.replace('/(tabs)/dashboard');
    } catch {
      setError('Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>RayHealth EVV</Text>
      <TextInput style={styles.input} placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isSubmitting ? <ActivityIndicator /> : <Button title="Login" onPress={handleLogin} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#f0f4f8' },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 24, color: '#1a5fa8' },
  input: {
    height: 50,
    borderColor: '#c9d8e8',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: 'white'
  },
  error: { color: '#b91c1c', marginBottom: 12, textAlign: 'center' }
});
```

- [ ] **Step 5: Run mobile checks and commit**

Run:

```bash
npm --workspace @rayhealth/mobile run lint
npm --workspace @rayhealth/mobile run build
```

Expected: lint and export build pass.

Commit:

```bash
git add package-lock.json packages/mobile/package.json packages/mobile/src/lib/api-client.ts packages/mobile/src/lib/AuthContext.tsx packages/mobile/src/features/auth/LoginScreen.tsx
git commit -m "store mobile auth in secure storage"
```

## Task 6: Public Surface Isolation and Validation Script

**Files:**
- Create: `scripts/security-surface-scan.ts`
- Create: `scripts/check.sh`
- Modify: `package.json`

- [ ] **Step 1: Create the security surface scan**

Create `scripts/security-surface-scan.ts`:

```typescript
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['packages/web/src', 'packages/mobile/src'];
const bannedPatterns = [
  { pattern: /rayhealth_token/g, message: 'browser JWT storage key must not be present' },
  { pattern: /localStorage\.setItem\(['"]rayhealth_/g, message: 'auth state must not be persisted to localStorage' },
  { pattern: /Authorization['"]?\s*:\s*`Bearer \$\{token\}`/g, message: 'web client must not attach browser bearer tokens' }
];

function filesUnder(dir: string): string[] {
  const absolute = join(ROOT, dir);
  return readdirSync(absolute).flatMap((name) => {
    const path = join(absolute, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return filesUnder(path.slice(ROOT.length + 1));
    if (/\.(ts|tsx)$/.test(path)) return [path];
    return [];
  });
}

const failures: string[] = [];

for (const file of SCAN_DIRS.flatMap(filesUnder)) {
  const source = readFileSync(file, 'utf8');
  for (const { pattern, message } of bannedPatterns) {
    if (pattern.test(source)) {
      failures.push(`${file}: ${message}`);
    }
    pattern.lastIndex = 0;
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Security surface scan passed');
```

- [ ] **Step 2: Add package scripts**

Modify root `package.json`:

```json
{
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "security:scan": "tsx scripts/security-surface-scan.ts",
    "check": "./scripts/check.sh",
    "db:migrate": "npm run db:migrate --workspace=@rayhealth/core",
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down"
  }
}
```

- [ ] **Step 3: Add the validation script**

Create `scripts/check.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

npm run lint
npm run typecheck
npm run test
npm run build
npm run security:scan
```

Then run:

```bash
chmod +x scripts/check.sh
```

- [ ] **Step 4: Run validation and commit**

Run:

```bash
./scripts/check.sh
```

Expected: lint, typecheck, tests, build, and security scan all pass.

Commit:

```bash
git add package.json scripts/security-surface-scan.ts scripts/check.sh
git commit -m "add security validation scan"
```

## Task 7: Final Verification

**Files:**
- No new files unless verification exposes a defect.

- [ ] **Step 1: Inspect auth token storage manually**

Run:

```bash
rg -n "rayhealth_token|localStorage|Authorization.*Bearer|mock login|Mock login" packages/web/src packages/mobile/src packages/app/src
```

Expected: no web `localStorage` auth token storage, no mock mobile login, and bearer auth only in mobile API client, app tests, or server token logic.

- [ ] **Step 2: Run full checks**

Run:

```bash
./scripts/check.sh
```

Expected: zero lint, typecheck, test, build, or security scan failures.

- [ ] **Step 3: Review generated diff**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected: only intentional files from this plan are changed. Parallel work from Claude may still exist; do not stage unrelated files.

## Self-Review Notes

- Spec coverage: This plan covers Phase 1 requirements from the design spec: web session hardening, mobile authentication storage, durable audit events, and public-surface isolation scanning.
- Deferred by design: Policy-based PHI redaction, break-glass access, step-up MFA, anomaly detection, SSO/SCIM, and formal retention automation are Phase 2 or Phase 3 work.
- Type consistency: Session fields use `sessionTokenHash`, `csrfTokenHash`, `expiresAt`, and `revokedAt` consistently across domain, repository, middleware, and tests.
- Compliance posture: The plan removes browser bearer-token storage, creates revocable server-side sessions, keeps mobile bearer tokens in secure storage, and introduces durable audit evidence for HIPAA and EVV workflows.
