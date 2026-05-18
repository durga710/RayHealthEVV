import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

describe('api prefix route compatibility', () => {
  it('serves protected API routes under the /api prefix used by the web app', async () => {
    const response = await request(createApp())
      .get('/api/tasks')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({
      id: '106',
      duty: 'Hair Care-Shampoo'
    });
  });
});
