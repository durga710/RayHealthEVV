import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { buildInviteUrl, createEmailClient } from '../email-client.js';

/**
 * These tests exercise the email client in two modes:
 *  - no-op client (AWS creds unset), must NOT instantiate or call the
 *    SDK and must resolve with `{ok: false, error: 'EMAIL_NOT_CONFIGURED'}`.
 *  - real client, mocks `SESv2Client.prototype.send` so we can assert
 *    the SendEmailCommand input shape without hitting AWS.
 *
 * We mock on the prototype to catch both `client.send(...)` and any
 * future `new Command()` wrapping; the input passed to `send` is the
 * `SendEmailCommand` instance, and its `.input` property is the
 * raw object that would go to SES, exactly what we want to assert on.
 */

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.AWS_SES_REGION;
  delete process.env.AWS_REGION;
  delete process.env.EMAIL_FROM;
  delete process.env.INVITE_URL_BASE;
  delete process.env.APP_URL;
  delete process.env.BASE_URL;
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe('createEmailClient', () => {
  it('returns a no-op client when AWS credentials are unset', async () => {
    // Sanity: ensure the SDK isn't touched at all.
    const sendSpy = vi.spyOn(SESv2Client.prototype, 'send');

    const client = createEmailClient();
    const result = await client.sendInviteEmail({
      to: 'caregiver@example.test',
      inviteUrl: 'https://app.example/accept-invite?token=abc',
      agencyName: 'Test Agency',
      role: 'caregiver',
      expiresAt: '2026-06-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error).toBe('EMAIL_NOT_CONFIGURED');
    }
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('returns a no-op client when only AWS_ACCESS_KEY_ID is set (missing secret)', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIA-test';
    const sendSpy = vi.spyOn(SESv2Client.prototype, 'send');

    const result = await createEmailClient().sendInviteEmail({
      to: 'a@b.test',
      inviteUrl: 'https://x.test/y',
      agencyName: 'X',
      role: 'caregiver',
      expiresAt: '2026-06-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toBe('EMAIL_NOT_CONFIGURED');
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it('sends via SES with the expected SendEmailCommand input shape', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIA-test';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret-test';
    process.env.EMAIL_FROM = 'Test <onboarding@test.example>';

    const sendSpy = vi
      .spyOn(SESv2Client.prototype, 'send')
      .mockResolvedValue({ MessageId: 'msg-ses-123' } as any);

    const result = await createEmailClient().sendInviteEmail({
      to: 'caregiver@example.test',
      inviteUrl: 'https://app.example/accept-invite?token=abc',
      agencyName: 'Keystone Home Care',
      role: 'caregiver',
      expiresAt: '2026-06-01T00:00:00.000Z',
      invitedByName: 'Alex Admin',
    });

    expect(result.ok).toBe(true);
    if (result.ok === true) expect(result.id).toBe('msg-ses-123');
    expect(sendSpy).toHaveBeenCalledTimes(1);

    const command = sendSpy.mock.calls[0]?.[0] as SendEmailCommand;
    expect(command).toBeInstanceOf(SendEmailCommand);
    const input = command.input;
    expect(input.FromEmailAddress).toBe('Test <onboarding@test.example>');
    expect(input.Destination?.ToAddresses).toEqual(['caregiver@example.test']);

    const simple = input.Content?.Simple;
    expect(simple?.Subject?.Data).toBe("You're invited to join Keystone Home Care on RayHealth EVV");
    expect(simple?.Subject?.Charset).toBe('UTF-8');
    expect(simple?.Body?.Html?.Data).toContain('https://app.example/accept-invite?token=abc');
    expect(simple?.Body?.Text?.Data).toContain('https://app.example/accept-invite?token=abc');
    expect(simple?.Body?.Html?.Data).toContain('Keystone Home Care');
    expect(simple?.Body?.Html?.Data).toContain('caregiver');
    // Sanity: AWS creds must never leak into the rendered email body.
    expect(simple?.Body?.Html?.Data).not.toContain('AKIA-test');
    expect(simple?.Body?.Text?.Data).not.toContain('AKIA-test');
    expect(simple?.Body?.Html?.Data).not.toContain('secret-test');
  });

  it('falls back to the default sender when EMAIL_FROM is unset', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIA-test';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret-test';

    const sendSpy = vi
      .spyOn(SESv2Client.prototype, 'send')
      .mockResolvedValue({ MessageId: 'msg-default' } as any);

    await createEmailClient().sendInviteEmail({
      to: 'a@b.test',
      inviteUrl: 'https://x.test/y',
      agencyName: 'X',
      role: 'caregiver',
      expiresAt: '2026-06-01T00:00:00.000Z',
    });

    const command = sendSpy.mock.calls[0]?.[0] as SendEmailCommand;
    expect(command.input.FromEmailAddress).toBe('RayHealth <onboarding@www.rayhealthevv.com>');
  });

  it('returns ok:false with an error category when SES throws a known error', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIA-test';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret-test';

    // Shape a fake SES SDK error: it has `name`, an optional `message`,
    // and a `$metadata.httpStatusCode`. The client must NOT propagate
    // the message (it can echo recipient data).
    const sesError = Object.assign(new Error('Email address is not verified'), {
      name: 'MessageRejected',
      $metadata: { httpStatusCode: 400 },
    });
    vi.spyOn(SESv2Client.prototype, 'send').mockRejectedValue(sesError);

    const result = await createEmailClient().sendInviteEmail({
      to: 'a@b.test',
      inviteUrl: 'https://x.test/y',
      agencyName: 'X',
      role: 'caregiver',
      expiresAt: '2026-06-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error).toContain('HTTP_400');
      expect(result.error).toContain('MessageRejected');
      // Upstream "message" text must not leak into the result.
      expect(result.error).not.toContain('not verified');
    }
  });

  it('returns ok:false with NO_MESSAGE_ID when SES responds without MessageId', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIA-test';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret-test';

    vi.spyOn(SESv2Client.prototype, 'send')
      .mockResolvedValue({} as any);

    const result = await createEmailClient().sendInviteEmail({
      to: 'a@b.test',
      inviteUrl: 'https://x.test/y',
      agencyName: 'X',
      role: 'caregiver',
      expiresAt: '2026-06-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toBe('NO_MESSAGE_ID');
  });

  it('falls back to UNKNOWN_ERROR for non-SDK errors', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIA-test';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret-test';

    vi.spyOn(SESv2Client.prototype, 'send').mockRejectedValue(new Error('boom'));

    const result = await createEmailClient().sendInviteEmail({
      to: 'a@b.test',
      inviteUrl: 'https://x.test/y',
      agencyName: 'X',
      role: 'caregiver',
      expiresAt: '2026-06-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    // A vanilla Error has `name: 'Error'` and no `$metadata`, we
    // surface that as the category rather than UNKNOWN_ERROR.
    if (result.ok === false) expect(result.error).toBe('Error');
  });
});

describe('buildInviteUrl', () => {
  it('prefers INVITE_URL_BASE when set', () => {
    process.env.INVITE_URL_BASE = 'https://rayhealthevv.com';
    process.env.APP_URL = 'https://other.example';
    expect(buildInviteUrl('abc-123')).toBe(
      'https://rayhealthevv.com/accept-invite?token=abc-123',
    );
  });

  it('falls back to APP_URL, then BASE_URL, then localhost', () => {
    process.env.APP_URL = 'https://app.example';
    expect(buildInviteUrl('id1')).toBe('https://app.example/accept-invite?token=id1');

    delete process.env.APP_URL;
    process.env.BASE_URL = 'https://base.example';
    expect(buildInviteUrl('id2')).toBe('https://base.example/accept-invite?token=id2');

    delete process.env.BASE_URL;
    expect(buildInviteUrl('id3')).toBe('http://localhost:5173/accept-invite?token=id3');
  });

  it('strips trailing slashes from the base', () => {
    process.env.INVITE_URL_BASE = 'https://rayhealthevv.com///';
    expect(buildInviteUrl('id')).toBe('https://rayhealthevv.com/accept-invite?token=id');
  });

  it('URL-encodes the invite id', () => {
    process.env.INVITE_URL_BASE = 'https://x.test';
    expect(buildInviteUrl('a b/c')).toBe('https://x.test/accept-invite?token=a%20b%2Fc');
  });
});
