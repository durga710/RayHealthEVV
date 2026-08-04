import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPushClient, resetPushClient, sanitizePushMessage } from '../push-client.js';

const OLD_ENV = { ...process.env };

function okResponse(tickets: unknown[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: tickets }),
  };
}

beforeEach(() => {
  delete process.env.PUSH_DISABLED;
  delete process.env.EXPO_ACCESS_TOKEN;
  resetPushClient();
});

afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetPushClient();
});

describe('sanitizePushMessage', () => {
  it('truncates a long body rather than letting the OS cut it arbitrarily', () => {
    const out = sanitizePushMessage({ tokens: ['t'], title: 'x'.repeat(200), body: 'y'.repeat(500) });
    expect(out.title).toHaveLength(100);
    expect(out.body).toHaveLength(240);
  });

  it('coerces data values to strings, which Expo requires', () => {
    const out = sanitizePushMessage({
      tokens: ['t'],
      title: 'a',
      body: 'b',
      data: { count: 3 as unknown as string, id: 'abc' },
    });
    expect(out.data).toEqual({ count: '3', id: 'abc' });
  });

  it('drops null data values instead of sending "null"', () => {
    const out = sanitizePushMessage({
      tokens: ['t'],
      title: 'a',
      body: 'b',
      data: { missing: null as unknown as string, id: 'abc' },
    });
    expect(out.data).toEqual({ id: 'abc' });
  });
});

describe('push client', () => {
  it('reports not configured and sends nothing when push is disabled', async () => {
    process.env.PUSH_DISABLED = '1';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await createPushClient().send({ tokens: ['t1'], title: 'a', body: 'b' });

    expect(result.notConfigured).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call the push service when there are no tokens', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await createPushClient().send({ tokens: [], title: 'a', body: 'b' });

    expect(result).toMatchObject({ sent: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('counts accepted tickets as sent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(okResponse([{ status: 'ok' }, { status: 'ok' }])),
    );

    const result = await createPushClient().send({ tokens: ['t1', 't2'], title: 'a', body: 'b' });

    expect(result).toMatchObject({ sent: 2, failed: 0, invalidTokens: [] });
  });

  it('surfaces dead devices so the caller can retire the token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okResponse([
          { status: 'ok' },
          { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } },
        ]),
      ),
    );

    const result = await createPushClient().send({ tokens: ['good', 'dead'], title: 'a', body: 'b' });

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.invalidTokens).toEqual(['dead']);
  });

  it('does not retire a token for a transient error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        okResponse([{ status: 'error', message: 'rate limited', details: { error: 'MessageRateExceeded' } }]),
      ),
    );

    const result = await createPushClient().send({ tokens: ['t1'], title: 'a', body: 'b' });

    expect(result.failed).toBe(1);
    expect(result.invalidTokens).toEqual([]);
  });

  it('batches beyond the Expo per-request ceiling', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
      const sentBatch = JSON.parse(init.body) as unknown[];
      return okResponse(sentBatch.map(() => ({ status: 'ok' })));
    });
    vi.stubGlobal('fetch', fetchMock);

    const tokens = Array.from({ length: 250 }, (_, i) => `token-${i}`);
    const result = await createPushClient().send({ tokens, title: 'a', body: 'b' });

    expect(fetchMock).toHaveBeenCalledTimes(3); // 100 + 100 + 50
    expect(result.sent).toBe(250);
  });

  it('treats a transport failure as failed delivery, never as success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const result = await createPushClient().send({ tokens: ['t1', 't2'], title: 'a', body: 'b' });

    expect(result).toMatchObject({ sent: 0, failed: 2, invalidTokens: [] });
  });

  it('treats a non-2xx response as failed delivery', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }));

    const result = await createPushClient().send({ tokens: ['t1'], title: 'a', body: 'b' });

    expect(result.failed).toBe(1);
  });

  it('authenticates when an Expo access token is configured', async () => {
    process.env.EXPO_ACCESS_TOKEN = 'secret-value';
    const fetchMock = vi.fn().mockResolvedValue(okResponse([{ status: 'ok' }]));
    vi.stubGlobal('fetch', fetchMock);

    await createPushClient().send({ tokens: ['t1'], title: 'a', body: 'b' });

    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.authorization).toBe('Bearer secret-value');
  });
});
