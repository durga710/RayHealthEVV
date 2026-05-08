import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

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
    const createAuditEvent = vi.fn().mockResolvedValue({});

    vi.spyOn(core, 'UserRepository').mockImplementation(() => ({ findByEmail }) as unknown as core.UserRepository);
    vi.spyOn(core, 'SessionRepository').mockImplementation(() => ({ create: createSession }) as unknown as core.SessionRepository);
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: createAuditEvent }) as unknown as core.AuditEventRepository);

    const response = await request(createApp())
      .post('/auth/login')
      .send({ email: 'admin@rayhealth.example', password: 'correct-password' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      userId: '00000000-0000-4000-8000-000000000011',
      role: 'admin',
      agencyId: '00000000-0000-4000-8000-000000000012'
    });
    expect(response.body.csrfToken).toEqual(expect.any(String));
    const setCookie = response.headers['set-cookie'] as unknown as string[];
    expect(setCookie.join(';')).toContain('rayhealth_session=');
    expect(setCookie.join(';')).toContain('HttpOnly');
  });

  it('continues to accept bearer JWTs for mobile and tests', async () => {
    const response = await request(createApp())
      .get('/auth/me')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('admin');
  });
});
