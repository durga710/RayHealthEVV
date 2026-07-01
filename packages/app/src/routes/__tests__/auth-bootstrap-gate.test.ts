import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  delete process.env.BOOTSTRAP_SECRET;
});

/**
 * The /auth/bootstrap secret gate (V16): the endpoint must be disabled unless
 * BOOTSTRAP_SECRET is set, and must reject a missing/incorrect secret before it
 * ever touches the database. These paths return early, so no DB is required.
 */
describe('auth bootstrap secret gate', () => {
  const body = {
    agencyId: '00000000-0000-4000-8000-000000000002',
    email: 'admin@example.test',
    password: 'a-strong-password-123',
  };

  it('is disabled (503) when BOOTSTRAP_SECRET is unset', async () => {
    delete process.env.BOOTSTRAP_SECRET;
    const res = await request(createApp()).post('/auth/bootstrap').send(body);
    expect(res.status).toBe(503);
  });

  it('rejects (403) a missing bootstrapSecret when one is configured', async () => {
    process.env.BOOTSTRAP_SECRET = 'the-real-secret';
    const res = await request(createApp()).post('/auth/bootstrap').send(body);
    expect(res.status).toBe(403);
  });

  it('rejects (403) an incorrect bootstrapSecret', async () => {
    process.env.BOOTSTRAP_SECRET = 'the-real-secret';
    const res = await request(createApp())
      .post('/auth/bootstrap')
      .send({ ...body, bootstrapSecret: 'wrong-secret' });
    expect(res.status).toBe(403);
  });
});
