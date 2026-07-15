import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import type { MobileSessionStore } from '../../services/mobile-session-store.js';
import { makeToken, setTestJwtSecret, TEST_MOBILE_JTI } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

const userId = '00000000-0000-4000-8000-000000000081';
const agencyId = '00000000-0000-4000-8000-000000000082';
const caregiverId = '00000000-0000-4000-8000-000000000083';

function sessionStore(overrides: Partial<MobileSessionStore> = {}): MobileSessionStore {
  return {
    findActiveByJti: vi.fn().mockImplementation(async (tokenJti: string) => ({
      id: '00000000-0000-4000-8000-000000000084',
      userId,
      tokenJti,
      expiresAt: '2099-01-01T00:00:00.000Z',
      createdAt: '2026-07-12T00:00:00.000Z',
    })),
    create: vi.fn().mockImplementation(async (input) => ({
      id: '00000000-0000-4000-8000-000000000084',
      ...input,
      createdAt: '2026-07-12T00:00:00.000Z',
    })),
    revokeByJti: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockProfile(): void {
  vi.spyOn(core, 'UserRepository').mockImplementation(
    () =>
      ({
        findById: vi.fn().mockResolvedValue({
          id: userId,
          agencyId,
          email: 'caregiver@rayhealth.example',
          role: 'caregiver',
          caregiverId,
        }),
      }) as unknown as core.UserRepository,
  );
  vi.spyOn(core, 'CaregiverRepository').mockImplementation(
    () => ({ findById: vi.fn().mockResolvedValue(null) }) as unknown as core.CaregiverRepository,
  );
}

describe('mobile session lifecycle', () => {
  it('rejects bearer tokens that have no registered jti', async () => {
    mockProfile();
    const response = await request(createApp())
      .get('/auth/mobile/me')
      .set('Authorization', `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId, null)}`);

    expect(response.status).toBe(401);
  });

  it('rejects a revoked or unknown mobile session', async () => {
    mockProfile();
    const mobileSessionStore = sessionStore({
      findActiveByJti: vi.fn().mockResolvedValue(undefined),
    });

    const response = await request(createApp({ mobileSessionStore }))
      .get('/auth/mobile/me')
      .set('Authorization', `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId)}`);

    expect(response.status).toBe(401);
  });

  it('creates a server-side session and puts its jti in a mobile login token', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 12);
    vi.spyOn(core, 'UserRepository').mockImplementation(
      () =>
        ({
          findByEmail: vi.fn().mockResolvedValue({
            id: userId,
            agencyId,
            email: 'caregiver@rayhealth.example',
            passwordHash,
            role: 'caregiver',
            caregiverId,
          }),
        }) as unknown as core.UserRepository,
    );
    vi.spyOn(core, 'UserAgencyRepository').mockImplementation(
      () => ({ listActiveForUser: vi.fn().mockResolvedValue([]) }) as unknown as core.UserAgencyRepository,
    );
    vi.spyOn(core, 'AgencyRepository').mockImplementation(
      () => ({ findById: vi.fn().mockResolvedValue({ id: agencyId, name: 'Ray Home Care' }) }) as unknown as core.AgencyRepository,
    );
    const create = vi.fn().mockImplementation(async (input) => ({
      id: '00000000-0000-4000-8000-000000000084',
      ...input,
      createdAt: '2026-07-12T00:00:00.000Z',
    }));
    const mobileSessionStore = sessionStore({ create });

    const response = await request(createApp({ mobileSessionStore }))
      .post('/auth/mobile/login')
      .send({ email: 'caregiver@rayhealth.example', password: 'correct-password' });

    expect(response.status).toBe(200);
    const claims = jwt.decode(response.body.token) as { jti?: string };
    expect(claims.jti).toEqual(expect.any(String));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      tokenJti: claims.jti,
    }));
  });

  it('revokes the current jti on mobile logout', async () => {
    const revokeByJti = vi.fn().mockResolvedValue(undefined);
    const mobileSessionStore = sessionStore({ revokeByJti });
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      () => ({ create: vi.fn().mockResolvedValue({}) }) as unknown as core.AuditEventRepository,
    );

    const response = await request(createApp({ mobileSessionStore }))
      .post('/auth/mobile/logout')
      .set('Authorization', `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId)}`);

    expect(response.status).toBe(204);
    expect(revokeByJti).toHaveBeenCalledWith(TEST_MOBILE_JTI, expect.any(String));
  });
});
