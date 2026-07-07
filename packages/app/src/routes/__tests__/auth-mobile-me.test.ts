import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /auth/mobile/me', () => {
  it('returns firstName/lastName from caregivers row when role=caregiver', async () => {
    const userId = '00000000-0000-4000-8000-000000000031';
    const agencyId = '00000000-0000-4000-8000-000000000032';
    const caregiverId = '00000000-0000-4000-8000-000000000033';

    const findById = vi.fn().mockResolvedValue({
      id: userId,
      agencyId,
      email: 'roman@rayhealth.example',
      passwordHash: 'unused',
      role: 'caregiver',
      caregiverId
    });
    const caregiverFindById = vi.fn().mockResolvedValue({
      id: caregiverId,
      agencyId,
      firstName: 'Roman',
      lastName: 'Ghimeray',
      email: 'roman@rayhealth.example',
      phone: null,
      npi: 'unused',
      hireDate: null,
      status: 'active'
    });

    vi.spyOn(core, 'UserRepository').mockImplementation(
      () => ({ findById }) as unknown as core.UserRepository
    );
    vi.spyOn(core, 'CaregiverRepository').mockImplementation(
      () => ({ findById: caregiverFindById }) as unknown as core.CaregiverRepository
    );

    const response = await request(createApp())
      .get('/auth/mobile/me')
      .set(
        'Authorization',
        `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId)}`
      );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      userId,
      email: 'roman@rayhealth.example',
      role: 'caregiver',
      agencyId,
      firstName: 'Roman',
      lastName: 'Ghimeray'
    });
  });

  it.skip('omits firstName/lastName when caregiver row is missing (degrade gracefully)', async () => {
    const userId = '00000000-0000-4000-8000-000000000034';
    const agencyId = '00000000-0000-4000-8000-000000000035';

    vi.spyOn(core, 'UserRepository').mockImplementation(
      () =>
        ({
          findById: vi.fn().mockResolvedValue({
            id: userId,
            agencyId,
            email: 'admin@rayhealth.example',
            passwordHash: 'unused',
            role: 'admin'
            // no caregiverId, admin-only user
          })
        }) as unknown as core.UserRepository
    );

    const response = await request(createApp())
      .get('/auth/mobile/me')
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body.firstName).toBeUndefined();
    expect(response.body.lastName).toBeUndefined();
    expect(response.body.userId).toBe(userId);
    expect(response.body.role).toBe('admin');
  });

  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(createApp()).get('/auth/mobile/me');
    expect(response.status).toBe(401);
  });
});
