import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

const TEST_SECRET = 'test-secret-for-unit-tests';

beforeAll(() => setTestJwtSecret());
afterEach(() => vi.restoreAllMocks());

const agencyId = '00000000-0000-4000-8000-0000000000a1';
const userId = '00000000-0000-4000-8000-0000000000a2';
const PASSWORD = 'correct-horse-battery';

function mockUserByEmail(overrides: Record<string, unknown> = {}) {
  const passwordHash = bcrypt.hashSync(PASSWORD, 4);
  const findByEmail = vi.fn().mockResolvedValue({
    id: userId,
    agencyId,
    email: 'cg@rayhealth.example',
    passwordHash,
    role: 'caregiver',
    caregiverId: undefined,
    totpEnabled: false,
    ...overrides,
  });
  vi.spyOn(core, 'UserRepository').mockImplementation(
    () => ({ findByEmail }) as unknown as core.UserRepository,
  );
  // listMobileAgencies fallback path.
  vi.spyOn(core, 'UserAgencyRepository').mockImplementation(
    () => ({ listActiveForUser: vi.fn().mockResolvedValue([]) }) as unknown as core.UserAgencyRepository,
  );
  vi.spyOn(core, 'AgencyRepository').mockImplementation(
    () => ({ findById: vi.fn().mockResolvedValue({ id: agencyId, name: 'Test Agency' }) }) as unknown as core.AgencyRepository,
  );
  return findByEmail;
}

describe('POST /auth/mobile/login — TOTP second factor (finding #1)', () => {
  it('does NOT mint a bearer token when TOTP is enrolled — returns a 2FA challenge instead', async () => {
    mockUserByEmail({ totpEnabled: true });

    const res = await request(createApp())
      .post('/auth/mobile/login')
      .send({ email: 'cg@rayhealth.example', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.twoFactorRequired).toBe(true);
    expect(res.body.challengeToken).toBeTruthy();
    // Critically: no session token is issued on the password-only step.
    expect(res.body.token).toBeUndefined();
  });

  it('mints a bearer token only when TOTP is not enrolled', async () => {
    mockUserByEmail({ totpEnabled: false });

    const res = await request(createApp())
      .post('/auth/mobile/login')
      .send({ email: 'cg@rayhealth.example', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.twoFactorRequired).toBeUndefined();
  });
});

describe('POST /auth/mobile/login/2fa', () => {
  it('rejects a challenge token with the wrong purpose', async () => {
    // A normal session/bearer-shaped token is not a valid 2FA challenge.
    const notAChallenge = jwt.sign({ sub: userId, agencyId, role: 'caregiver' }, TEST_SECRET, {
      expiresIn: '5m',
      algorithm: 'HS256',
    });
    const res = await request(createApp())
      .post('/auth/mobile/login/2fa')
      .send({ challengeToken: notAChallenge, code: '123456' });
    expect(res.status).toBe(401);
  });
});

describe('mobile bearer token revocation (finding #2)', () => {
  it('rejects a validly-signed bearer token whose mobile_sessions row is missing/revoked', async () => {
    // Signature is valid, but no active mobile_sessions row exists for the jti.
    vi.spyOn(core, 'MobileSessionRepository').mockImplementation(
      () => ({ findActiveByJti: vi.fn().mockResolvedValue(undefined) }) as unknown as core.MobileSessionRepository,
    );

    const res = await request(createApp())
      .get('/auth/mobile/me')
      .set('Authorization', `Bearer ${makeToken('caregiver', agencyId, userId)}`);

    expect(res.status).toBe(401);
  });

  it('rejects a bearer token that carries no jti at all', async () => {
    const noJti = jwt.sign({ sub: userId, agencyId, role: 'caregiver' }, TEST_SECRET, {
      expiresIn: '1h',
      algorithm: 'HS256',
    });
    const res = await request(createApp())
      .get('/auth/mobile/me')
      .set('Authorization', `Bearer ${noJti}`);

    expect(res.status).toBe(401);
  });
});
