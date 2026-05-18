import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

const AGENCY_ID = 'agency-1';

const CAREGIVERS: core.Caregiver[] = [
  {
    agencyId: AGENCY_ID,
    firstName: 'Maria',
    lastName: 'Lopez',
    email: 'maria@keystone.example',
    status: 'active',
  },
  {
    agencyId: AGENCY_ID,
    firstName: 'Carlos',
    lastName: 'Rivera',
    email: 'carlos@keystone.example',
    status: 'active',
  },
];

function mockCaregiverRepo(caregivers: core.Caregiver[] = CAREGIVERS): ReturnType<typeof vi.fn> {
  const findByAgency = vi.fn().mockResolvedValue(caregivers);
  vi.spyOn(core, 'CaregiverRepository').mockImplementation(function MockRepo() {
    return { findByAgency } as unknown as core.CaregiverRepository;
  } as unknown as typeof core.CaregiverRepository);
  return findByAgency;
}

describe('GET /staff', () => {
  it('returns agency caregivers in the { success, data } envelope', async () => {
    const findByAgency = mockCaregiverRepo();

    const response = await request(createApp())
      .get('/staff')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data[0].email).toBe('maria@keystone.example');
    expect(response.body.data[0].firstName).toBe('Maria');
    expect(findByAgency).toHaveBeenCalledWith(AGENCY_ID);
  });

  it('returns empty list when agency has no caregivers', async () => {
    mockCaregiverRepo([]);

    const response = await request(createApp())
      .get('/staff')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([]);
  });

  it('also reachable via /api prefix', async () => {
    mockCaregiverRepo();

    const response = await request(createApp())
      .get('/api/staff')
      .set('Authorization', `Bearer ${makeToken('admin')}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(createApp()).get('/staff');
    expect(response.status).toBe(401);
  });
});
