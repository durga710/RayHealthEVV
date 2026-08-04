import { afterEach, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { notifyCaregivers } from '../notification-service.js';
import * as pushClient from '../../push/push-client.js';

const agencyId = 'agency-1';

interface UserRow {
  id: string;
  caregiver_id: string | null;
  notification_prefs: Record<string, unknown> | null;
}

/**
 * Minimal knex stand-in for `db('users').whereIn(...).andWhere(...).select(...)`.
 */
function fakeDb(users: UserRow[]) {
  return (() => ({
    whereIn: () => ({
      andWhere: () => ({
        select: async () => users,
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

function mockSend(result: Partial<pushClient.PushSendResult> = {}) {
  const send = vi
    .fn()
    .mockResolvedValue({ sent: 1, failed: 0, invalidTokens: [], ...result });
  vi.spyOn(pushClient, 'getPushClient').mockReturnValue({ send });
  return send;
}

afterEach(() => vi.restoreAllMocks());

describe('notifyCaregivers', () => {
  it('sends to a caregiver whose preferences are untouched', async () => {
    mockTokens([{ token: 'tok-1', userId: 'user-1' }]);
    const send = mockSend();
    const db = fakeDb([{ id: 'user-1', caregiver_id: 'cg-1', notification_prefs: null }]);

    const result = await notifyCaregivers(db, {
      agencyId,
      caregiverIds: ['cg-1'],
      category: 'scheduleChanges',
      title: 'Schedule updated',
      body: 'One of your shifts changed.',
    });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ tokens: ['tok-1'] }));
    expect(result.sent).toBe(1);
  });

  it('respects a switched-off category', async () => {
    mockTokens([{ token: 'tok-1', userId: 'user-1' }]);
    const send = mockSend();
    const db = fakeDb([
      { id: 'user-1', caregiver_id: 'cg-1', notification_prefs: { scheduleChanges: false } },
    ]);

    await notifyCaregivers(db, {
      agencyId,
      caregiverIds: ['cg-1'],
      category: 'scheduleChanges',
      title: 't',
      body: 'b',
    });

    expect(send).not.toHaveBeenCalled();
  });

  it('respects a switched-off push channel even when the category is on', async () => {
    mockTokens([{ token: 'tok-1', userId: 'user-1' }]);
    const send = mockSend();
    const db = fakeDb([
      {
        id: 'user-1',
        caregiver_id: 'cg-1',
        notification_prefs: { scheduleChanges: true, channelPush: false },
      },
    ]);

    await notifyCaregivers(db, {
      agencyId,
      caregiverIds: ['cg-1'],
      category: 'scheduleChanges',
      title: 't',
      body: 'b',
    });

    expect(send).not.toHaveBeenCalled();
  });

  it('parses preferences stored as a json string', async () => {
    mockTokens([{ token: 'tok-1', userId: 'user-1' }]);
    const send = mockSend();
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

    await notifyCaregivers(db, {
      agencyId,
      caregiverIds: ['cg-1'],
      category: 'scheduleChanges',
      title: 't',
      body: 'b',
    });

    expect(send).not.toHaveBeenCalled();
  });

  it('sends only to the opted-in caregiver in a mixed group', async () => {
    mockTokens([
      { token: 'tok-in', userId: 'user-in' },
      { token: 'tok-out', userId: 'user-out' },
    ]);
    const send = mockSend();
    const db = fakeDb([
      { id: 'user-in', caregiver_id: 'cg-1', notification_prefs: null },
      { id: 'user-out', caregiver_id: 'cg-2', notification_prefs: { scheduleChanges: false } },
    ]);

    await notifyCaregivers(db, {
      agencyId,
      caregiverIds: ['cg-1', 'cg-2'],
      category: 'scheduleChanges',
      title: 't',
      body: 'b',
    });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ tokens: ['tok-in'] }));
  });

  it('retires tokens the push service reported as dead', async () => {
    const { disableTokens } = mockTokens([{ token: 'dead', userId: 'user-1' }]);
    mockSend({ sent: 0, failed: 1, invalidTokens: ['dead'] });
    const db = fakeDb([{ id: 'user-1', caregiver_id: 'cg-1', notification_prefs: null }]);

    await notifyCaregivers(db, {
      agencyId,
      caregiverIds: ['cg-1'],
      category: 'scheduleChanges',
      title: 't',
      body: 'b',
    });

    expect(disableTokens).toHaveBeenCalledWith(['dead'], 'DeviceNotRegistered');
  });

  it('does nothing when the caregiver has no registered device', async () => {
    mockTokens([]);
    const send = mockSend();

    const result = await notifyCaregivers(fakeDb([]), {
      agencyId,
      caregiverIds: ['cg-1'],
      category: 'scheduleChanges',
      title: 't',
      body: 'b',
    });

    expect(send).not.toHaveBeenCalled();
    expect(result.sent).toBe(0);
  });

  it('swallows a failure rather than breaking the action that triggered it', async () => {
    vi.spyOn(core, 'PushTokenRepository').mockImplementation(() => {
      throw new Error('database unavailable');
    });

    const result = await notifyCaregivers(fakeDb([]), {
      agencyId,
      caregiverIds: ['cg-1'],
      category: 'scheduleChanges',
      title: 't',
      body: 'b',
    });

    expect(result).toEqual({ sent: 0, failed: 0, invalidTokens: [] });
  });
});
