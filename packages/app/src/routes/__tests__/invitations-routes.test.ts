import request from 'supertest';
import bcrypt from 'bcryptjs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

const VALID_UUID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const FAR_FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const FAR_PAST = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

function makePendingInvite(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: VALID_UUID,
    agencyId: 'agency-1',
    email: 'invitee@keystone.example',
    role: 'caregiver',
    status: 'pending',
    invitedBy: 'user-1',
    expiresAt: FAR_FUTURE,
    acceptedAt: null,
    agencyName: 'Keystone Care',
    ...over
  };
}

function mockInviteLookup(invite: ReturnType<typeof makePendingInvite> | undefined) {
  vi.spyOn(core, 'CaregiverRepository').mockImplementation(
    function () {
      return {
        findInviteById: vi.fn().mockResolvedValue(invite),
        create: vi.fn(),
        markInviteAccepted: vi.fn()
      } as any;
    } as unknown as (db: unknown) => core.CaregiverRepository
  );
  vi.spyOn(core, 'UserRepository').mockImplementation(
    function () {
      return { create: vi.fn(), findByEmail: vi.fn().mockResolvedValue(undefined) } as any;
    } as unknown as (db: unknown) => core.UserRepository
  );
  vi.spyOn(core, 'UserAgencyRepository').mockImplementation(
    function () {
      return { create: vi.fn(), findMembership: vi.fn().mockResolvedValue(undefined) } as any;
    } as unknown as (db: unknown) => core.UserAgencyRepository
  );
  vi.spyOn(core, 'AuditEventRepository').mockImplementation(
    function () {
      return { create: vi.fn() } as any;
    } as unknown as (db: unknown) => core.AuditEventRepository
  );
}

/**
 * The accept route runs `await db.transaction(async (trx) => ...)`.
 * Tests can't reach a real DB, so we replace the app's db with a fake
 * that calls the callback synchronously with itself as the trx handle.
 * The mocked `*Repository(trx)` ignores the trx arg via `vi.spyOn`.
 */
function appWithFakeTransactionDb(): ReturnType<typeof createApp> {
  const app = createApp();
  const fakeDb = {
    transaction: async (cb: (trx: unknown) => unknown) => cb(fakeDb),
    schema: { hasTable: async () => true }
  };
  app.set('db', fakeDb);
  return app;
}

describe('GET /invitations/:token (public lookup)', () => {
  it('rejects malformed UUIDs with 400', async () => {
    const response = await request(createApp()).get('/invitations/not-a-uuid');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ isValid: false, status: 'invalid' });
  });

  it('returns 404 + same envelope for unknown tokens', async () => {
    mockInviteLookup(undefined);
    const response = await request(createApp()).get(`/invitations/${VALID_UUID}`);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ isValid: false, status: 'not_found' });
  });

  it('returns isValid:true for a pending non-expired invite, including agency name', async () => {
    mockInviteLookup(makePendingInvite());
    const response = await request(createApp()).get(`/invitations/${VALID_UUID}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      token: VALID_UUID,
      email: 'invitee@keystone.example',
      role: 'caregiver',
      agencyId: 'agency-1',
      agencyName: 'Keystone Care',
      status: 'pending',
      isValid: true
    });
  });

  it('returns isValid:false + status:accepted for an already-redeemed invite', async () => {
    mockInviteLookup(
      makePendingInvite({
        acceptedAt: new Date().toISOString(),
        status: 'accepted'
      })
    );
    const response = await request(createApp()).get(`/invitations/${VALID_UUID}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'accepted', isValid: false });
  });

  it('returns isValid:false + status:expired for an expired invite', async () => {
    mockInviteLookup(makePendingInvite({ expiresAt: FAR_PAST }));
    const response = await request(createApp()).get(`/invitations/${VALID_UUID}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'expired', isValid: false });
  });
});

describe('POST /invitations/accept (public redemption)', () => {
  const validBody = {
    token: VALID_UUID,
    firstName: 'Smoke',
    lastName: 'Test',
    password: 'SmokeTestPassword2026',
    phone: '5555550100'
  };

  it('rejects malformed token with 400', async () => {
    const response = await request(appWithFakeTransactionDb())
      .post('/invitations/accept')
      .send({ ...validBody, token: 'bad' });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid token/i);
  });

  it('rejects missing firstName/lastName with 400', async () => {
    const response = await request(appWithFakeTransactionDb())
      .post('/invitations/accept')
      .send({ ...validBody, firstName: '' });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/firstName and lastName/i);
  });

  it('rejects passwords shorter than 12 chars with 400', async () => {
    const response = await request(appWithFakeTransactionDb())
      .post('/invitations/accept')
      .send({ ...validBody, password: 'short' });
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/at least 12 characters/i);
  });

  it('returns 404 when the token does not match an invite', async () => {
    mockInviteLookup(undefined);
    const response = await request(appWithFakeTransactionDb())
      .post('/invitations/accept')
      .send(validBody);
    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/not found/i);
  });

  it('returns 409 for an already-redeemed invite (single-use enforcement)', async () => {
    mockInviteLookup(
      makePendingInvite({ acceptedAt: new Date().toISOString(), status: 'accepted' })
    );
    const response = await request(appWithFakeTransactionDb())
      .post('/invitations/accept')
      .send(validBody);
    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already used/i);
  });

  it('returns 410 for an expired invite', async () => {
    mockInviteLookup(makePendingInvite({ expiresAt: FAR_PAST }));
    const response = await request(appWithFakeTransactionDb())
      .post('/invitations/accept')
      .send(validBody);
    expect(response.status).toBe(410);
    expect(response.body.message).toMatch(/expired/i);
  });

  it('happy path: creates user (caregiver), membership, marks invite accepted, audit event', async () => {
    const invite = makePendingInvite();
    const userCreate = vi.fn().mockResolvedValue({
      id: 'user-new',
      agencyId: 'agency-1',
      email: invite.email,
      role: 'caregiver'
    });
    const caregiverCreate = vi.fn().mockResolvedValue({
      id: 'caregiver-new',
      agencyId: 'agency-1',
      firstName: 'Smoke',
      lastName: 'Test',
      email: invite.email,
      status: 'active'
    });
    const markAccepted = vi.fn().mockResolvedValue(undefined);
    const auditCreate = vi.fn().mockResolvedValue({});
    const membershipCreate = vi.fn().mockResolvedValue({});

    vi.spyOn(core, 'CaregiverRepository').mockImplementation(
      () =>
        ({
          findInviteById: vi.fn().mockResolvedValue(invite),
          create: caregiverCreate,
          markInviteAccepted: markAccepted
        } as any)
    );
    vi.spyOn(core, 'UserRepository').mockImplementation(
      () => ({ create: userCreate, findByEmail: vi.fn().mockResolvedValue(undefined) } as any)
    );
    vi.spyOn(core, 'UserAgencyRepository').mockImplementation(
      () => ({ create: membershipCreate, findMembership: vi.fn().mockResolvedValue(undefined) } as any)
    );
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      () => ({ create: auditCreate } as any)
    );

    const response = await request(appWithFakeTransactionDb())
      .post('/invitations/accept')
      .send({ ...validBody, password: 'a-good-12char-password' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ userId: 'user-new', linkedExistingAccount: false });
    expect(response.body.message).toMatch(/welcome/i);
    expect(caregiverCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: 'agency-1',
        firstName: 'Smoke',
        lastName: 'Test',
        email: invite.email,
        status: 'active'
      })
    );
    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        agencyId: 'agency-1',
        email: invite.email,
        role: 'caregiver',
        caregiverId: 'caregiver-new'
      })
    );
    expect(membershipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-new',
        agencyId: 'agency-1',
        role: 'caregiver',
        caregiverId: 'caregiver-new'
      })
    );
    expect(markAccepted).toHaveBeenCalledWith(VALID_UUID, 'user-new', expect.any(String));
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'invite.accepted',
        entityType: 'invite',
        entityId: VALID_UUID,
        agencyId: 'agency-1',
        actorId: 'user-new'
      })
    );
  });
});

describe('POST /invitations/accept — existing account at another agency (multi-agency link)', () => {
  const PASSWORD = 'existing-account-pw-2026';
  const validBody = {
    token: VALID_UUID,
    firstName: 'Smoke',
    lastName: 'Test',
    password: PASSWORD,
    phone: '5555550100'
  };

  function existingUser(over: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'user-existing',
      agencyId: 'agency-OTHER',
      email: 'invitee@keystone.example',
      passwordHash: bcrypt.hashSync(PASSWORD, 4),
      role: 'caregiver',
      caregiverId: 'caregiver-other',
      ...over
    };
  }

  function mockLinkScenario({
    user,
    membership
  }: {
    user: ReturnType<typeof existingUser>;
    membership?: Record<string, unknown>;
  }) {
    const caregiverCreate = vi.fn().mockResolvedValue({
      id: 'caregiver-new-agency',
      agencyId: 'agency-1',
      firstName: 'Smoke',
      lastName: 'Test',
      email: user.email,
      status: 'active'
    });
    const markAccepted = vi.fn().mockResolvedValue(undefined);
    const userCreate = vi.fn();
    const membershipCreate = vi.fn().mockResolvedValue({});
    const auditCreate = vi.fn().mockResolvedValue({});

    vi.spyOn(core, 'CaregiverRepository').mockImplementation(
      () =>
        ({
          findInviteById: vi.fn().mockResolvedValue(makePendingInvite()),
          create: caregiverCreate,
          markInviteAccepted: markAccepted
        } as any)
    );
    vi.spyOn(core, 'UserRepository').mockImplementation(
      () => ({ create: userCreate, findByEmail: vi.fn().mockResolvedValue(user) } as any)
    );
    vi.spyOn(core, 'UserAgencyRepository').mockImplementation(
      () =>
        ({
          create: membershipCreate,
          findMembership: vi.fn().mockResolvedValue(membership)
        } as any)
    );
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      () => ({ create: auditCreate } as any)
    );

    return { caregiverCreate, markAccepted, userCreate, membershipCreate, auditCreate };
  }

  it('links the inviting agency to the existing account when the password matches', async () => {
    const mocks = mockLinkScenario({ user: existingUser() });

    const response = await request(appWithFakeTransactionDb())
      .post('/invitations/accept')
      .send(validBody);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ userId: 'user-existing', linkedExistingAccount: true });
    // A NEW caregiver record is created at the inviting agency…
    expect(mocks.caregiverCreate).toHaveBeenCalledWith(
      expect.objectContaining({ agencyId: 'agency-1', email: 'invitee@keystone.example' })
    );
    // …and a membership links the EXISTING user — no new user account.
    expect(mocks.membershipCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-existing',
        agencyId: 'agency-1',
        role: 'caregiver',
        caregiverId: 'caregiver-new-agency'
      })
    );
    expect(mocks.userCreate).not.toHaveBeenCalled();
    expect(mocks.markAccepted).toHaveBeenCalledWith(VALID_UUID, 'user-existing', expect.any(String));
    // Privacy: the response must not name any other agency.
    expect(JSON.stringify(response.body)).not.toMatch(/agency-OTHER/);
  });

  it('rejects the link with 409 + code when the existing-account password is wrong', async () => {
    const mocks = mockLinkScenario({ user: existingUser() });

    const response = await request(appWithFakeTransactionDb())
      .post('/invitations/accept')
      .send({ ...validBody, password: 'not-the-right-password' });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EXISTING_ACCOUNT_PASSWORD_REQUIRED');
    expect(mocks.membershipCreate).not.toHaveBeenCalled();
    expect(mocks.caregiverCreate).not.toHaveBeenCalled();
  });

  it('rejects with 409 when the account is already connected to the inviting agency', async () => {
    const mocks = mockLinkScenario({
      user: existingUser(),
      membership: { userId: 'user-existing', agencyId: 'agency-1', status: 'active' }
    });

    const response = await request(appWithFakeTransactionDb())
      .post('/invitations/accept')
      .send(validBody);

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already connected/i);
    expect(mocks.membershipCreate).not.toHaveBeenCalled();
  });

  it('rejects with 409 when the existing account is not a caregiver account', async () => {
    const mocks = mockLinkScenario({ user: existingUser({ role: 'admin' }) });

    const response = await request(appWithFakeTransactionDb())
      .post('/invitations/accept')
      .send(validBody);

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already exists/i);
    expect(mocks.membershipCreate).not.toHaveBeenCalled();
  });
});
