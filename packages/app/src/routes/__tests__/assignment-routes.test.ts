import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';

describe('assignment routes', () => {
  it('creates an assignment when the authorization and caregiver are valid', async () => {
    const response = await request(createApp())
      .post('/assignments')
      .set('x-agency-id', 'agency-1')
      .set('x-user-role', 'coordinator')
      .send({
        clientId: 'client-1',
        caregiverId: 'caregiver-1',
        visitTemplateId: 'template-1',
        authorizationId: 'auth-1',
        visitDate: '2026-05-20'
      });

    expect(response.status).toBe(201);
  });
});
