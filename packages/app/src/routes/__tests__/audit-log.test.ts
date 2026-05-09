import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

describe('audit logging middleware', () => {
  it('persists a structured audit event for protected write requests', async () => {
    const createAuditEvent = vi.fn().mockResolvedValue({});
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: createAuditEvent }) as unknown as core.AuditEventRepository);
    vi.spyOn(core, 'CaregiverRepository').mockImplementation(() => ({
      createInvite: vi.fn().mockResolvedValue({
        id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
        agencyId: 'agency-1',
        email: 'caregiver@keystone.example',
        role: 'caregiver',
        status: 'pending',
        invitedBy: 'user-1',
        expiresAt: '2026-05-23T14:00:00.000Z'
      })
    } as any));

    const response = await request(createApp())
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'caregiver@keystone.example', role: 'caregiver' });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(response.status).toBe(201);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'phi.create',
      outcome: 'success',
      payload: expect.objectContaining({
        method: 'POST',
        path: '/invites',
        authMethod: 'bearer'
      })
    }));
  });
});
