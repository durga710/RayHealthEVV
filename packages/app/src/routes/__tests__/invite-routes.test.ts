import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

describe('invite routes', () => {
  it('creates a pending staff invite for a caregiver role', async () => {
    vi.spyOn(core, 'CaregiverRepository').mockImplementation(
      function () {
        return {
          createInvite: vi.fn().mockResolvedValue({
            id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
            agencyId: 'agency-1',
            email: 'caregiver@keystone.example',
            role: 'caregiver',
            status: 'pending',
            invitedBy: 'user-1',
            expiresAt: '2026-05-23T14:00:00.000Z'
          })
        } as any;
      } as unknown as (db: unknown) => core.CaregiverRepository
    );
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      function () {
        return { create: vi.fn().mockResolvedValue({}) } as any;
      } as unknown as (db: unknown) => core.AuditEventRepository
    );

    const response = await request(createApp())
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'caregiver@keystone.example', role: 'caregiver' });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('pending');
  });
});
