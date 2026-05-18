import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { inviteStore } from '../invite-routes.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());
beforeEach(() => inviteStore.clear());

describe('POST /invites', () => {
  it('creates a pending staff invite for a caregiver role', async () => {
    const response = await request(createApp())
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'caregiver@keystone.example', role: 'caregiver' });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('pending');
    expect(response.body.email).toBe('caregiver@keystone.example');
    expect(response.body.id).toBeTruthy();
  });
});

describe('POST /invites/:id/resend', () => {
  it('resends a pending invite and returns success envelope', async () => {
    const app = createApp();
    const create = await request(app)
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'nurse@keystone.example', role: 'caregiver' });
    const { id } = create.body as { id: string };

    const response = await request(app)
      .post(`/invites/${id}/resend`)
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(id);
  });

  it('returns 404 for unknown invite id', async () => {
    const response = await request(createApp())
      .post('/invites/non-existent-id/resend')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it('returns 409 when trying to resend an accepted invite', async () => {
    const app = createApp();
    const create = await request(app)
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'accepted@keystone.example', role: 'caregiver' });
    const { id } = create.body as { id: string };
    // Manually mark as accepted in the store
    const invite = inviteStore.get(id)!;
    invite.status = 'accepted';

    const response = await request(app)
      .post(`/invites/${id}/resend`)
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it('returns 409 when trying to resend a revoked invite', async () => {
    const app = createApp();
    const create = await request(app)
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'revoked@keystone.example', role: 'caregiver' });
    const { id } = create.body as { id: string };
    const invite = inviteStore.get(id)!;
    invite.status = 'revoked';

    const response = await request(app)
      .post(`/invites/${id}/resend`)
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(409);
  });
});

describe('POST /invites/:id/revoke', () => {
  it('revokes a pending invite and returns success envelope', async () => {
    const app = createApp();
    const create = await request(app)
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'torevoke@keystone.example', role: 'caregiver' });
    const { id } = create.body as { id: string };

    const response = await request(app)
      .post(`/invites/${id}/revoke`)
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('revoked');
  });

  it('returns 404 for unknown invite id', async () => {
    const response = await request(createApp())
      .post('/invites/unknown-id/revoke')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});

describe('GET /invites', () => {
  it('returns empty list when agency has no invites', async () => {
    const response = await request(createApp())
      .get('/invites')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([]);
  });

  it('lists invites for the agency without exposing any token field', async () => {
    const app = createApp();
    await request(app)
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'a@keystone.example', role: 'caregiver' });
    await request(app)
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'b@keystone.example', role: 'coordinator' });

    const response = await request(app)
      .get('/invites')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
    // No token or access_code should leak
    for (const item of response.body.data as object[]) {
      expect(item).not.toHaveProperty('token');
      expect(item).not.toHaveProperty('accessCode');
      expect(item).not.toHaveProperty('access_code');
    }
  });
});
