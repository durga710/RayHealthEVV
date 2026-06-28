import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

const VALID_AUTH = {
  clientId: 'client-1',
  payerId: 'payer-1',
  unitsAuthorized: 100,
  serviceCode: 'T1019',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
};

describe('authorization routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects a non-canonical (W-series) service code with 400', async () => {
    const createAuthorization = vi.fn();
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
      clientBelongsToAgency: vi.fn().mockResolvedValue(true),
      createAuthorization,
    } as any));

    const res = await request(createApp())
      .post('/authorizations')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ ...VALID_AUTH, serviceCode: 'W1793' });

    expect(res.status).toBe(400);
    expect(createAuthorization).not.toHaveBeenCalled();
  });

  it('rejects an authorization for a client in another agency with 404', async () => {
    const createAuthorization = vi.fn();
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
      clientBelongsToAgency: vi.fn().mockResolvedValue(false),
      createAuthorization,
    } as any));

    const res = await request(createApp())
      .post('/authorizations')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send(VALID_AUTH);

    expect(res.status).toBe(404);
    expect(createAuthorization).not.toHaveBeenCalled();
  });

  it('creates a valid authorization with 201', async () => {
    const createAuthorization = vi.fn().mockResolvedValue({ id: 'auth-1', ...VALID_AUTH });
    vi.spyOn(core, 'ClientRepository').mockImplementation(() => ({
      clientBelongsToAgency: vi.fn().mockResolvedValue(true),
      createAuthorization,
    } as any));

    const res = await request(createApp())
      .post('/authorizations')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send(VALID_AUTH);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('auth-1');
    expect(createAuthorization).toHaveBeenCalled();
  });
});
