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

  it('logs a phi.read for the caregiver mobile schedule (client name + home address + coordinates)', async () => {
    // Regression for the audit gap: /mobile/* was excluded from PHI_GET_PATHS,
    // so the most-frequent PHI read in the product (a caregiver opening their
    // day, which returns client names, home addresses, and home GPS) wrote no
    // audit row, contradicting the published "every PHI read is logged" claim.
    const createAuditEvent = vi.fn().mockResolvedValue({});
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: createAuditEvent }) as unknown as core.AuditEventRepository);
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
      getTodaysScheduleForCaregiver: vi.fn().mockResolvedValue([])
    } as unknown as core.ScheduleRepository));

    const response = await request(createApp())
      .get('/mobile/caregiver/today')
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', 'caregiver-1')}`);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(response.status).toBe(200);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'phi.read',
      outcome: 'success',
      payload: expect.objectContaining({ method: 'GET', path: '/mobile/caregiver/today' })
    }));
  });

  it('records a genuine authorization denial (403) as permission.denied', async () => {
    // A caregiver lacks agency.read, so the Command Center board 403s. The
    // board IS a PHI path (client names), so the middleware logs the attempt , 
    // and a real authz denial is the one case that stays `permission.denied`.
    const createAuditEvent = vi.fn().mockResolvedValue({});
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: createAuditEvent }) as unknown as core.AuditEventRepository);

    const response = await request(createApp())
      .get('/command-center/today')
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', 'caregiver-1')}`);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(response.status).toBe(403);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'permission.denied',
      outcome: 'denied'
    }));
  });

  it('records a non-authorization failure (500) with the lifecycle type + outcome=failure, not permission.denied', async () => {
    // A 404/422/5xx is the same lifecycle action that failed, not an access
    // denial. Tagging it permission.denied would pollute the forensic taxonomy.
    const createAuditEvent = vi.fn().mockResolvedValue({});
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: createAuditEvent }) as unknown as core.AuditEventRepository);
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({
      getTodaysScheduleForCaregiver: vi.fn().mockRejectedValue(new Error('db down'))
    } as unknown as core.ScheduleRepository));

    const response = await request(createApp())
      .get('/mobile/caregiver/today')
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', 'caregiver-1')}`);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(response.status).toBe(500);
    expect(createAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'phi.read',
      outcome: 'failure'
    }));
    expect(createAuditEvent).not.toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'permission.denied'
    }));
  });
});
