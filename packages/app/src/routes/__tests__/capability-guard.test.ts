import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

describe('capability guards', () => {
  it('blocks caregiver access to admin-only routes', async () => {
    const response = await request(createApp())
      .get('/agencies/current')
      .set('Authorization', `Bearer ${makeToken('caregiver')}`);

    expect(response.status).toBe(403);
  });
});
