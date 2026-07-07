import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Self-serve signup creates the agency in `review_status='pending'`. It must NOT
 * authenticate the new tenant, no session row, no session cookie, otherwise an
 * unapproved agency could operate the system and bypass the super-admin review
 * gate. These tests lock that behavior in.
 */
describe('auth signup route', () => {
  function mockSignupRepos() {
    const createSession = vi.fn();
    const createAuditEvent = vi.fn().mockResolvedValue({});

    vi.spyOn(core, 'UserRepository').mockImplementation(() => ({
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000001',
        agencyId: '00000000-0000-4000-8000-000000000002',
        role: 'admin',
      }),
      recordTermsAcceptance: vi.fn().mockResolvedValue(undefined),
    }) as unknown as core.UserRepository);
    vi.spyOn(core, 'AgencyRepository').mockImplementation(() => ({
      createAgency: vi.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000002' }),
    }) as unknown as core.AgencyRepository);
    vi.spyOn(core, 'SessionRepository').mockImplementation(() => ({
      create: createSession,
    }) as unknown as core.SessionRepository);
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({
      create: createAuditEvent,
    }) as unknown as core.AuditEventRepository);

    const app = createApp();
    // The signup handler runs its writes inside db.transaction(cb); the real knex
    // instance would try to connect, so substitute a fake that just runs the cb.
    app.set('db', { transaction: async (cb: (trx: unknown) => unknown) => cb({}) });
    return { app, createSession, createAuditEvent };
  }

  const validBody = {
    agencyName: 'Sunrise Home Care LLC',
    state: 'PA',
    adminEmail: 'admin@sunrise.example',
    password: 'a-very-strong-passphrase',
    acceptedTerms: true,
  };

  it('registers the agency without issuing a session or cookie', async () => {
    const { app, createSession } = mockSignupRepos();

    const response = await request(app).post('/auth/signup').send(validBody);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ status: 'pending_review' });
    expect(response.body.message).toEqual(expect.any(String));
    // No session cookie may be set.
    const setCookie = (response.headers['set-cookie'] as unknown as string[]) ?? [];
    expect(setCookie.join(';')).not.toContain('rayhealth_session=');
    // No session row may be created.
    expect(createSession).not.toHaveBeenCalled();
    // Must not leak a usable csrf token (which would imply a live session).
    expect(response.body.csrfToken).toBeUndefined();
  });

  it('records an agency.review.requested audit event on signup', async () => {
    const { app, createAuditEvent } = mockSignupRepos();

    await request(app).post('/auth/signup').send(validBody);

    expect(createAuditEvent).toHaveBeenCalledTimes(1);
    expect(createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'agency.review.requested', outcome: 'success' }),
    );
  });
});
