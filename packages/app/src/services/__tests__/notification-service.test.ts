import { afterEach, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { notifyCaregivers } from '../notification-service.js';
import * as pushClient from '../../push/push-client.js';
import * as smsClient from '../../sms/sms-client.js';

const agencyId = 'agency-1';

interface UserRow {
  id: string;
  caregiver_id: string | null;
  notification_prefs: Record<string, unknown> | null;
  phone?: string | null;
  caregiver_phone?: string | null;
}

/**
 * Minimal knex stand-in for the recipient query:
 *   db('users as u').leftJoin(...).whereIn(...).andWhere(...).select(...)
 */
function fakeDb(users: UserRow[]) {
  return (() => ({
    leftJoin: () => ({
      whereIn: () => ({
        andWhere: () => ({
          select: async () =>
            users.map((u) => ({ phone: null, caregiver_phone: null, ...u })),
        }),
      }),
    }),
  })) as unknown as Parameters<typeof notifyCaregivers>[0];
}

function mockTokens(tokens: Array<{ token: string; userId: string }>) {
  const disableTokens = vi.fn().mockResolvedValue(1);
  vi.spyOn(core, 'PushTokenRepository').mockImplementation(
    () =>
      ({
        listForCaregivers: vi
          .fn()
          .mockResolvedValue(tokens.map((t) => ({ ...t, agencyId, caregiverId: 'cg-1' }))),
        disableTokens,
      }) as unknown as core.PushTokenRepository,
  );
  return { disableTokens };
}

function mockPush(result: Partial<pushClient.PushSendResult> = {}) {
  const send = vi.fn().mockResolvedValue({ sent: 1, failed: 0, invalidTokens: [], ...result });
  vi.spyOn(pushClient, 'getPushClient').mockReturnValue({ send });
  return send;
}

function mockSms(ok = true) {
  const send = vi
    .fn()
    .mockResolvedValue(ok ? { ok: true, id: 'SM1' } : { ok: false, error: 'x', retryable: false });
  vi.spyOn(smsClient, 'getSmsClient').mockReturnValue({ send });
  return send;
}

const baseInput = {
  agencyId,
  caregiverIds: ['cg-1'],
  category: 'scheduleChanges' as const,
  title: 'Schedule updated',
  body: 'One of your shifts changed.',
};

afterEach(() => vi.restoreAllMocks());

describe('notifyCaregivers, push channel', () => {
  it('sends to a caregiver whose preferences are untouched', async () => {
    mockTokens([{ token: 'tok-1', userId: 'user-1' }]);
    const send = mockPush();
    mockSms();
    const db = fakeDb([{ id: 'user-1', caregiver_id: 'cg-1', notification_prefs: null }]);

    const result = await notifyCaregivers(db, baseInput);

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ tokens: ['tok-1'] }));
    expect(result.sent).toBe(1);
  });

  it('respects a switched-off category', async () => {
    mockTokens([{ token: 'tok-1', userId: 'user-1' }]);
    const send = mockPush();
    const db = fakeDb([
      { id: 'user-1', caregiver_id: 'cg-1', notification_prefs: { scheduleChanges: false } },
    ]);

    await notifyCaregivers(db, baseInput);

    expect(send).not.toHaveBeenCalled();
  });

  it('respects a switched-off push channel even when the category is on', async () => {
    mockTokens([{ token: 'tok-1', userId: 'user-1' }]);
    const send = mockPush();
    const db = fakeDb([
      {
        id: 'user-1',
        caregiver_id: 'cg-1',
        notification_prefs: { scheduleChanges: true, channelPush: false },
      },
    ]);

    await notifyCaregivers(db, baseInput);

    expect(send).not.toHaveBeenCalled();
  });

  it('parses preferences stored as a json string', async () => {
    mockTokens([{ token: 'tok-1', userId: 'user-1' }]);
    const send = mockPush();
    const db = fakeDb([
      {
        id: 'user-1',
        caregiver_id: 'cg-1',
        notification_prefs: JSON.stringify({ scheduleChanges: false }) as unknown as Record<
          string,
          unknown
        >,
      },
    ]);

    await notifyCaregivers(db, baseInput);

    expect(send).not.toHaveBeenCalled();
  });

  it('retires tokens the push service reported as dead', async () => {
    const { disableTokens } = mockTokens([{ token: 'dead', userId: 'user-1' }]);
    mockPush({ sent: 0, failed: 1, invalidTokens: ['dead'] });
    const db = fakeDb([{ id: 'user-1', caregiver_id: 'cg-1', notification_prefs: null }]);

    await notifyCaregivers(db, baseInput);

    expect(disableTokens).toHaveBeenCalledWith(['dead'], 'DeviceNotRegistered');
  });

  it('does nothing when the caregiver has no registered device', async () => {
    mockTokens([]);
    const send = mockPush();
    const db = fakeDb([{ id: 'user-1', caregiver_id: 'cg-1', notification_prefs: null }]);

    const result = await notifyCaregivers(db, baseInput);

    expect(send).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
  });

  it('swallows a failure rather than breaking the action that triggered it', async () => {
    vi.spyOn(core, 'PushTokenRepository').mockImplementation(() => {
      throw new Error('database unavailable');
    });
    mockSms();

    const result = await notifyCaregivers(
      fakeDb([{ id: 'user-1', caregiver_id: 'cg-1', notification_prefs: null }]),
      baseInput,
    );

    expect(result.sent).toBe(0);
  });
});

describe('notifyCaregivers, sms channel', () => {
  const smsInput = { ...baseInput, alsoSms: true, smsBody: 'RayHealth: a shift was cancelled.' };

  it('does not text unless the caller opts in', async () => {
    mockTokens([]);
    mockPush();
    const send = mockSms();
    const db = fakeDb([
      { id: 'user-1', caregiver_id: 'cg-1', notification_prefs: { channelSms: true }, phone: '4125550123' },
    ]);

    await notifyCaregivers(db, baseInput);

    expect(send).not.toHaveBeenCalled();
  });

  it('does not text a caregiver who never opted in, since SMS defaults off', async () => {
    mockTokens([]);
    mockPush();
    const send = mockSms();
    const db = fakeDb([
      { id: 'user-1', caregiver_id: 'cg-1', notification_prefs: null, phone: '4125550123' },
    ]);

    await notifyCaregivers(db, smsInput);

    expect(send).not.toHaveBeenCalled();
  });

  it('texts an opted-in caregiver, normalizing the stored number', async () => {
    mockTokens([]);
    mockPush();
    const send = mockSms();
    const db = fakeDb([
      {
        id: 'user-1',
        caregiver_id: 'cg-1',
        notification_prefs: { channelSms: true },
        phone: '(412) 555-0123',
      },
    ]);

    const result = await notifyCaregivers(db, smsInput);

    expect(send).toHaveBeenCalledWith({
      to: '+14125550123',
      body: 'RayHealth: a shift was cancelled.',
    });
    expect(result.smsSent).toBe(1);
  });

  it('falls back to the caregiver record when the login has no number', async () => {
    mockTokens([]);
    mockPush();
    const send = mockSms();
    const db = fakeDb([
      {
        id: 'user-1',
        caregiver_id: 'cg-1',
        notification_prefs: { channelSms: true },
        phone: null,
        caregiver_phone: '4125550199',
      },
    ]);

    await notifyCaregivers(db, smsInput);

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: '+14125550199' }));
  });

  it('skips an unusable number silently rather than counting a failure', async () => {
    mockTokens([]);
    mockPush();
    const send = mockSms();
    const db = fakeDb([
      { id: 'user-1', caregiver_id: 'cg-1', notification_prefs: { channelSms: true }, phone: '555-0123' },
    ]);

    const result = await notifyCaregivers(db, smsInput);

    expect(send).not.toHaveBeenCalled();
    expect(result.smsFailed).toBe(0);
  });

  it('texts each number once when two logins share it', async () => {
    mockTokens([]);
    mockPush();
    const send = mockSms();
    const db = fakeDb([
      { id: 'user-1', caregiver_id: 'cg-1', notification_prefs: { channelSms: true }, phone: '4125550123' },
      { id: 'user-2', caregiver_id: 'cg-2', notification_prefs: { channelSms: true }, phone: '412-555-0123' },
    ]);

    await notifyCaregivers(db, { ...smsInput, caregiverIds: ['cg-1', 'cg-2'] });

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('counts a provider rejection as a failed text', async () => {
    mockTokens([]);
    mockPush();
    mockSms(false);
    const db = fakeDb([
      { id: 'user-1', caregiver_id: 'cg-1', notification_prefs: { channelSms: true }, phone: '4125550123' },
    ]);

    const result = await notifyCaregivers(db, smsInput);

    expect(result.smsFailed).toBe(1);
    expect(result.smsSent).toBe(0);
  });

  it('still delivers push when the sms provider blows up', async () => {
    mockTokens([{ token: 'tok-1', userId: 'user-1' }]);
    const push = mockPush();
    vi.spyOn(smsClient, 'getSmsClient').mockImplementation(() => {
      throw new Error('provider misconfigured');
    });
    const db = fakeDb([
      { id: 'user-1', caregiver_id: 'cg-1', notification_prefs: { channelSms: true }, phone: '4125550123' },
    ]);

    const result = await notifyCaregivers(db, smsInput);

    expect(push).toHaveBeenCalled();
    expect(result.sent).toBe(1);
    expect(result.smsFailed).toBe(0);
  });

  it('does not text when the category itself is off, even with sms opted in', async () => {
    mockTokens([]);
    mockPush();
    const send = mockSms();
    const db = fakeDb([
      {
        id: 'user-1',
        caregiver_id: 'cg-1',
        notification_prefs: { channelSms: true, scheduleChanges: false },
        phone: '4125550123',
      },
    ]);

    await notifyCaregivers(db, smsInput);

    expect(send).not.toHaveBeenCalled();
  });
});
