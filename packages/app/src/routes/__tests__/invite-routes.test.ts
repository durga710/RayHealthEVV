import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

// Snapshot env AFTER setTestJwtSecret so we preserve JWT_SECRET across
// the surrounding env-mutation in beforeEach. Captured lazily inside
// beforeAll so the snapshot includes the JWT_SECRET this helper sets.
let ENV_SNAPSHOT: NodeJS.ProcessEnv = {};

beforeAll(() => {
  setTestJwtSecret();
  ENV_SNAPSHOT = { ...process.env };
});

beforeEach(() => {
  process.env = { ...ENV_SNAPSHOT };
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.AWS_SES_REGION;
  delete process.env.AWS_REGION;
  delete process.env.INVITE_URL_BASE;
  delete process.env.APP_URL;
  delete process.env.BASE_URL;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  process.env = { ...ENV_SNAPSHOT };
});

/**
 * Stub the agency + user lookups the route does to build the email body.
 * Both default to "no row found", that's fine, the route falls back to
 * sensible defaults. Tests that care can call this with overrides.
 */
function stubLookups(opts?: {
  agencyName?: string;
  inviterEmail?: string;
}): void {
  const agencyName = opts?.agencyName ?? 'Test Agency';
  const inviterEmail = opts?.inviterEmail ?? 'admin@test.example';
  vi.spyOn(core, 'AgencyRepository').mockImplementation(
    function () {
      return {
        findById: vi.fn().mockResolvedValue({ id: 'agency-1', name: agencyName, state: 'PA' })
      } as any;
    } as unknown as (db: unknown) => core.AgencyRepository
  );
  vi.spyOn(core, 'UserRepository').mockImplementation(
    function () {
      return {
        findById: vi.fn().mockResolvedValue({ id: 'user-1', email: inviterEmail, role: 'admin' })
      } as any;
    } as unknown as (db: unknown) => core.UserRepository
  );
}

describe('POST /invites', () => {
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
    stubLookups();

    const response = await request(createApp())
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'caregiver@keystone.example', role: 'caregiver' });

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('pending');
  });

  it('returns emailDelivery: not_configured when AWS credentials are unset', async () => {
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
    stubLookups();

    const sesSpy = vi.spyOn(SESv2Client.prototype, 'send');

    const response = await request(createApp())
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'caregiver@keystone.example', role: 'caregiver' });

    expect(response.status).toBe(201);
    expect(response.body.emailDelivery).toBe('not_configured');
    // Sanity: no upstream call.
    expect(sesSpy).not.toHaveBeenCalled();
    // The acceptPath fallback must still be present so the admin can
    // copy and share manually.
    expect(response.body.acceptPath).toContain('/accept-invite?token=');
  });

  it('returns emailDelivery: sent when SES accepts the message', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIA-test';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret-test';

    vi.spyOn(core, 'CaregiverRepository').mockImplementation(
      function () {
        return {
          createInvite: vi.fn().mockResolvedValue({
            id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
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
    const auditCreate = vi.fn().mockResolvedValue({});
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      function () {
        return { create: auditCreate } as any;
      } as unknown as (db: unknown) => core.AuditEventRepository
    );
    stubLookups({ agencyName: 'Keystone Home Care' });

    const sesSpy = vi
      .spyOn(SESv2Client.prototype, 'send')
      .mockResolvedValue({ MessageId: 'msg-abc-123' } as any);

    const response = await request(createApp())
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'caregiver@keystone.example', role: 'caregiver' });

    expect(response.status).toBe(201);
    expect(response.body.emailDelivery).toBe('sent');
    expect(sesSpy).toHaveBeenCalledTimes(1);

    // An invite.email.sent audit row must have been written with the
    // messageId, and crucially, the audit payload must NOT contain
    // the URL or any token-looking value.
    const sentCalls = auditCreate.mock.calls.filter(
      (c: unknown[]) => (c[0] as { eventType: string }).eventType === 'invite.email.sent'
    );
    expect(sentCalls).toHaveLength(1);
    const payload = (sentCalls[0]?.[0] as { payload: Record<string, unknown> }).payload;
    expect(payload.messageId).toBe('msg-abc-123');
    expect(JSON.stringify(payload)).not.toContain('accept-invite');
    expect(JSON.stringify(payload)).not.toContain('bbbbbbbb');
  });

  it('returns emailDelivery: failed when SES rejects the request', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIA-test';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret-test';

    vi.spyOn(core, 'CaregiverRepository').mockImplementation(
      function () {
        return {
          createInvite: vi.fn().mockResolvedValue({
            id: 'cccccccc-cccc-4ccc-cccc-cccccccccccc',
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
    const auditCreate = vi.fn().mockResolvedValue({});
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      function () {
        return { create: auditCreate } as any;
      } as unknown as (db: unknown) => core.AuditEventRepository
    );
    stubLookups();

    const sesError = Object.assign(new Error('Email address is not verified'), {
      name: 'MessageRejected',
      $metadata: { httpStatusCode: 400 },
    });
    vi.spyOn(SESv2Client.prototype, 'send').mockRejectedValue(sesError);

    const response = await request(createApp())
      .post('/invites')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ email: 'caregiver@keystone.example', role: 'caregiver' });

    // The invite itself is still 201, email is best-effort.
    expect(response.status).toBe(201);
    expect(response.body.emailDelivery).toBe('failed');
    // Manual fallback path must still be present.
    expect(response.body.acceptPath).toContain('/accept-invite?token=');

    // invite.email.failed audit row with an error category but no URL.
    const failedCalls = auditCreate.mock.calls.filter(
      (c: unknown[]) => (c[0] as { eventType: string }).eventType === 'invite.email.failed'
    );
    expect(failedCalls).toHaveLength(1);
    const payload = (failedCalls[0]?.[0] as { payload: Record<string, unknown> }).payload;
    expect(typeof payload.error).toBe('string');
    expect(JSON.stringify(payload)).not.toContain('accept-invite');
  });
});

describe('POST /invites/:id/resend-email', () => {
  it('resends the email for a pending invite and returns emailDelivery: sent', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIA-test';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret-test';

    vi.spyOn(core, 'CaregiverRepository').mockImplementation(
      function () {
        return {
          findInviteById: vi.fn().mockResolvedValue({
            id: 'dddddddd-dddd-4ddd-dddd-dddddddddddd',
            agencyId: 'agency-1',
            email: 'caregiver@keystone.example',
            role: 'caregiver',
            status: 'pending',
            invitedBy: 'user-1',
            expiresAt: new Date(Date.now() + 86400_000).toISOString(),
            acceptedAt: null,
            agencyName: 'Keystone Home Care'
          })
        } as any;
      } as unknown as (db: unknown) => core.CaregiverRepository
    );
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      function () {
        return { create: vi.fn().mockResolvedValue({}) } as any;
      } as unknown as (db: unknown) => core.AuditEventRepository
    );
    stubLookups();

    vi.spyOn(SESv2Client.prototype, 'send')
      .mockResolvedValue({ MessageId: 'msg-resend-1' } as any);

    const response = await request(createApp())
      .post('/invites/dddddddd-dddd-4ddd-dddd-dddddddddddd/resend-email')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.emailDelivery).toBe('sent');
    expect(response.body.email).toBe('caregiver@keystone.example');
    // The response MUST NOT include the invite URL, that's a second
    // disclosure path we deliberately closed.
    expect(JSON.stringify(response.body)).not.toContain('accept-invite');
  });

  it('returns 404 for an invite in a different agency', async () => {
    vi.spyOn(core, 'CaregiverRepository').mockImplementation(
      function () {
        return {
          findInviteById: vi.fn().mockResolvedValue({
            id: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee',
            agencyId: 'agency-2', // different agency
            email: 'a@b.test',
            role: 'caregiver',
            status: 'pending',
            invitedBy: 'user-99',
            expiresAt: new Date(Date.now() + 86400_000).toISOString(),
            acceptedAt: null,
            agencyName: 'Other Agency'
          })
        } as any;
      } as unknown as (db: unknown) => core.CaregiverRepository
    );

    const response = await request(createApp())
      .post('/invites/eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee/resend-email')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({});

    expect(response.status).toBe(404);
  });

  it('returns 409 when the invite is already accepted', async () => {
    vi.spyOn(core, 'CaregiverRepository').mockImplementation(
      function () {
        return {
          findInviteById: vi.fn().mockResolvedValue({
            id: 'ffffffff-ffff-4fff-ffff-ffffffffffff',
            agencyId: 'agency-1',
            email: 'a@b.test',
            role: 'caregiver',
            status: 'accepted',
            invitedBy: 'user-1',
            expiresAt: new Date(Date.now() + 86400_000).toISOString(),
            acceptedAt: new Date().toISOString(),
            agencyName: 'Test'
          })
        } as any;
      } as unknown as (db: unknown) => core.CaregiverRepository
    );

    const response = await request(createApp())
      .post('/invites/ffffffff-ffff-4fff-ffff-ffffffffffff/resend-email')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({});

    expect(response.status).toBe(409);
  });

  it('returns 410 when the invite has already expired', async () => {
    vi.spyOn(core, 'CaregiverRepository').mockImplementation(
      function () {
        return {
          findInviteById: vi.fn().mockResolvedValue({
            id: '11111111-1111-4111-1111-111111111111',
            agencyId: 'agency-1',
            email: 'a@b.test',
            role: 'caregiver',
            status: 'pending',
            invitedBy: 'user-1',
            // Expired one day ago.
            expiresAt: new Date(Date.now() - 86400_000).toISOString(),
            acceptedAt: null,
            agencyName: 'Test'
          })
        } as any;
      } as unknown as (db: unknown) => core.CaregiverRepository
    );

    const response = await request(createApp())
      .post('/invites/11111111-1111-4111-1111-111111111111/resend-email')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({});

    expect(response.status).toBe(410);
  });

  it('refuses callers without the staff.write capability', async () => {
    // A `family` role token, has no staff.write capability.
    const response = await request(createApp())
      .post('/invites/22222222-2222-4222-2222-222222222222/resend-email')
      .set('Authorization', `Bearer ${makeToken('family')}`)
      .send({});

    expect(response.status).toBe(403);
  });
});
