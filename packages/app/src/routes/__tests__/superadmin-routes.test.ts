import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { setTestJwtSecret } from './test-helpers.js';

const USERNAME = 'TestSuper';
const PASSWORD = 'super-secret-pass';

beforeAll(async () => {
  setTestJwtSecret();
  process.env.SUPER_ADMIN_USERNAME = USERNAME;
  process.env.SUPER_ADMIN_PASSWORD_HASH = await bcrypt.hash(PASSWORD, 4);
});

afterEach(() => vi.restoreAllMocks());

async function platformToken(): Promise<string> {
  const res = await request(createApp())
    .post('/superadmin/login')
    .send({ username: USERNAME, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

describe('super-admin routes', () => {
  it('issues a platform token for correct credentials', async () => {
    const res = await request(createApp())
      .post('/superadmin/login')
      .send({ username: USERNAME, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('rejects wrong credentials with 401', async () => {
    const res = await request(createApp())
      .post('/superadmin/login')
      .send({ username: USERNAME, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('blocks agency listing without a platform token', async () => {
    const res = await request(createApp()).get('/superadmin/agencies');
    expect(res.status).toBe(401);
  });

  it('lists agencies with a valid platform token', async () => {
    const listAgencies = vi.fn().mockResolvedValue([{ id: 'a1', name: 'Acme', reviewStatus: 'pending' }]);
    vi.spyOn(core, 'PlatformAdminRepository').mockImplementation(() => ({ listAgencies } as any));

    const token = await platformToken();
    const res = await request(createApp())
      .get('/superadmin/agencies')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('approves an agency and audits it', async () => {
    const setAgencyReview = vi.fn().mockResolvedValue({ id: 'a1', name: 'Acme' });
    vi.spyOn(core, 'PlatformAdminRepository').mockImplementation(() => ({ setAgencyReview } as any));
    const create = vi.fn().mockResolvedValue({});
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create } as any));

    const token = await platformToken();
    const res = await request(createApp())
      .post('/superadmin/agencies/a1/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.reviewStatus).toBe('approved');
    expect(setAgencyReview).toHaveBeenCalledWith('a1', 'approved', USERNAME, null);
  });

  it('404s approving an unknown agency', async () => {
    vi.spyOn(core, 'PlatformAdminRepository').mockImplementation(() => ({
      setAgencyReview: vi.fn().mockResolvedValue(null),
    } as any));
    const token = await platformToken();
    const res = await request(createApp())
      .post('/superadmin/agencies/missing/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('suspends a user and audits it', async () => {
    const setUserSuspended = vi.fn().mockResolvedValue({ agencyId: 'a1', email: 'x@y.z' });
    vi.spyOn(core, 'PlatformAdminRepository').mockImplementation(() => ({ setUserSuspended } as any));
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: vi.fn().mockResolvedValue({}) } as any));

    const token = await platformToken();
    const res = await request(createApp())
      .post('/superadmin/users/u1/suspend')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.suspended).toBe(true);
    expect(setUserSuspended).toHaveBeenCalledWith('u1', true);
  });

  it('rejects an agency-scoped (non-platform) token', async () => {
    // A token without scope:'platform' must not reach the console.
    const { default: jwt } = await import('jsonwebtoken');
    const agencyToken = jwt.sign({ sub: 'u1', agencyId: 'a1', role: 'admin' }, process.env.JWT_SECRET!, { algorithm: 'HS256' });
    const res = await request(createApp())
      .get('/superadmin/agencies')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });
});
