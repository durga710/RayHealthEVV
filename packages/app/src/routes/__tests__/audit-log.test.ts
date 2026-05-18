import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

function mockAuditEventRepository(createAuditEvent: ReturnType<typeof vi.fn>): void {
  vi.spyOn(core, 'AuditEventRepository').mockImplementation(function AuditEventRepositoryMock() {
    return { create: createAuditEvent } as unknown as core.AuditEventRepository;
  } as unknown as typeof core.AuditEventRepository);
}

describe('audit logging middleware', () => {
  it('persists a structured audit event for protected write requests', async () => {
    const createAuditEvent = vi.fn().mockResolvedValue({});
    mockAuditEventRepository(createAuditEvent);

    const response = await request(createApp())
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'caregiver@keystone.example', role: 'caregiver' });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(response.status).toBe(201);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'request.write',
      outcome: 'success',
      payload: expect.objectContaining({
        method: 'POST',
        path: '/invites',
        authMethod: 'bearer'
      })
    }));
  });

  it('records the actual resource name when protected writes arrive through /api', async () => {
    const createAuditEvent = vi.fn().mockResolvedValue({});
    mockAuditEventRepository(createAuditEvent);

    const response = await request(createApp())
      .post('/api/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'caregiver@keystone.example', role: 'caregiver' });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(response.status).toBe(201);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'invites',
      payload: expect.objectContaining({
        path: '/api/invites'
      })
    }));
  });
});
