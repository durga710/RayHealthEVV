import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());
afterEach(() => vi.restoreAllMocks());

const agencyId = '00000000-0000-4000-8000-0000000000d1';
const userId = '00000000-0000-4000-8000-0000000000d2';
const caregiverId = '00000000-0000-4000-8000-0000000000d3';
const TOKEN = 'ExponentPushToken[abcdefghijklmnopqrst]';

function mockRepo(overrides: Record<string, unknown>) {
  vi.spyOn(core, 'PushTokenRepository').mockImplementation(
    () => overrides as unknown as core.PushTokenRepository,
  );
}

function auth() {
  return `Bearer ${makeToken('caregiver', agencyId, userId, caregiverId)}`;
}

describe('POST /notifications/push-tokens', () => {
  it('registers against the session agency, not one supplied by the caller', async () => {
    const register = vi.fn().mockResolvedValue({ id: 'p1' });
    mockRepo({ register });

    const res = await request(createApp())
      .post('/notifications/push-tokens')
      .set('Authorization', auth())
      // A caller-supplied agency must be ignored; tenancy comes from the session.
      .send({ token: TOKEN, platform: 'ios', agencyId: 'attacker-agency' });

    expect(res.status).toBe(200);
    expect(register).toHaveBeenCalledWith({
      agencyId,
      userId,
      caregiverId,
      token: TOKEN,
      platform: 'ios',
    });
  });

  it('defaults an unknown platform rather than rejecting the device', async () => {
    const register = vi.fn().mockResolvedValue({ id: 'p1' });
    mockRepo({ register });

    await request(createApp())
      .post('/notifications/push-tokens')
      .set('Authorization', auth())
      .send({ token: TOKEN });

    expect(register).toHaveBeenCalledWith(expect.objectContaining({ platform: 'unknown' }));
  });

  it('rejects a malformed token', async () => {
    const register = vi.fn();
    mockRepo({ register });

    expect(
      (
        await request(createApp())
          .post('/notifications/push-tokens')
          .set('Authorization', auth())
          .send({ token: 'short' })
      ).status,
    ).toBe(400);
    expect(register).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    mockRepo({ register: vi.fn() });
    const res = await request(createApp())
      .post('/notifications/push-tokens')
      .send({ token: TOKEN });
    expect(res.status).toBe(401);
  });

  it('does not leak the device token in the error body', async () => {
    mockRepo({ register: vi.fn().mockRejectedValue(new Error(`insert failed for ${TOKEN}`)) });

    const res = await request(createApp())
      .post('/notifications/push-tokens')
      .set('Authorization', auth())
      .send({ token: TOKEN });

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('ExponentPushToken');
  });
});

describe('DELETE /notifications/push-tokens', () => {
  it('unregisters scoped to the session agency', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    mockRepo({ unregister });

    const res = await request(createApp())
      .delete('/notifications/push-tokens')
      .set('Authorization', auth())
      .send({ token: TOKEN });

    expect(res.status).toBe(200);
    // Signing out of one agency must not silence another on the same device.
    expect(unregister).toHaveBeenCalledWith(TOKEN, agencyId);
  });

  it('treats removing an unknown token as success, so sign-out is idempotent', async () => {
    mockRepo({ unregister: vi.fn().mockResolvedValue(false) });

    const res = await request(createApp())
      .delete('/notifications/push-tokens')
      .set('Authorization', auth())
      .send({ token: TOKEN });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
