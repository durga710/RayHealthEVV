import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

describe('staff credential routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const caregiverInAgency = { id: 'cg-1', agencyId: 'agency-1', status: 'active' };

  it('lists a caregiver credentials with a compliance roll-up', async () => {
    vi.spyOn(core, 'CaregiverRepository').mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(caregiverInAgency),
      getCredentials: vi.fn().mockResolvedValue([
        { id: 'cr-1', caregiverId: 'cg-1', credentialType: 'tb-screening', status: 'active', expiresAt: '2030-01-01' },
      ]),
    } as any));

    const res = await request(createApp())
      .get('/staff/caregivers/cg-1/credentials')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body.credentials).toHaveLength(1);
    // Only tb-screening present → still missing background-check/license/training.
    expect(res.body.compliance.compliant).toBe(false);
    expect(res.body.compliance.missing).toContain('background-check');
  });

  it('adds a credential and returns 201', async () => {
    const saveCredential = vi.fn().mockResolvedValue({
      id: 'cr-new', caregiverId: 'cg-1', credentialType: 'license', status: 'active', expiresAt: '2030-06-01',
    });
    vi.spyOn(core, 'CaregiverRepository').mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(caregiverInAgency),
      saveCredential,
    } as any));
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
      create: vi.fn().mockResolvedValue({}),
    } as any));

    const res = await request(createApp())
      .post('/staff/caregivers/cg-1/credentials')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ credentialType: 'license', status: 'active', expiresAt: '2030-06-01' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('cr-new');
    expect(saveCredential).toHaveBeenCalled();
  });

  it('rejects an invalid credential type with 400', async () => {
    vi.spyOn(core, 'CaregiverRepository').mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(caregiverInAgency),
      saveCredential: vi.fn(),
    } as any));

    const res = await request(createApp())
      .post('/staff/caregivers/cg-1/credentials')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ credentialType: 'not-a-real-type', expiresAt: '2030-06-01' });

    expect(res.status).toBe(400);
  });

  it('returns 404 when the caregiver is not in the agency', async () => {
    vi.spyOn(core, 'CaregiverRepository').mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(undefined),
      saveCredential: vi.fn(),
    } as any));

    const res = await request(createApp())
      .post('/staff/caregivers/cg-9/credentials')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ credentialType: 'license', expiresAt: '2030-06-01' });

    expect(res.status).toBe(404);
  });

  it('expires a credential and returns 200', async () => {
    const expireCredential = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(core, 'CaregiverRepository').mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue(caregiverInAgency),
      expireCredential,
    } as any));
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
      create: vi.fn().mockResolvedValue({}),
    } as any));

    const res = await request(createApp())
      .delete('/staff/caregivers/cg-1/credentials/cr-1')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'cr-1', status: 'expired' });
    expect(expireCredential).toHaveBeenCalledWith('cr-1', 'agency-1');
  });

  it('forbids coordinators from writing credentials (no staff.write)', async () => {
    const res = await request(createApp())
      .post('/staff/caregivers/cg-1/credentials')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ credentialType: 'license', expiresAt: '2030-06-01' });

    expect(res.status).toBe(403);
  });
});
