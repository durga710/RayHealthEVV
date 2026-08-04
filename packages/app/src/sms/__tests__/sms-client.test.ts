import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSmsClient, isSmsConfigured, resetSmsClient, toE164, truncateSmsBody } from '../sms-client.js';

const OLD_ENV = { ...process.env };

function configureTwilio() {
  process.env.TWILIO_ACCOUNT_SID = 'AC00000000000000000000000000000000';
  process.env.TWILIO_AUTH_TOKEN = 'auth-token-value';
  process.env.TWILIO_FROM_NUMBER = '+14125550000';
}

beforeEach(() => {
  delete process.env.SMS_DISABLED;
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_FROM_NUMBER;
  resetSmsClient();
});

afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetSmsClient();
});

describe('toE164', () => {
  it('normalizes the shapes a human actually types', () => {
    expect(toE164('(412) 555-0123')).toBe('+14125550123');
    expect(toE164('412.555.0123')).toBe('+14125550123');
    expect(toE164('1-412-555-0123')).toBe('+14125550123');
    expect(toE164('4125550123')).toBe('+14125550123');
  });

  it('passes through a number that is already E.164', () => {
    expect(toE164('+442071838750')).toBe('+442071838750');
  });

  it('rejects rather than guesses, because a wrong guess texts a stranger', () => {
    expect(toE164('555-0123')).toBeNull();
    expect(toE164('not a phone')).toBeNull();
    expect(toE164('')).toBeNull();
    expect(toE164(null)).toBeNull();
    expect(toE164(undefined)).toBeNull();
    // Eleven digits not starting with 1 is not a number we can place.
    expect(toE164('24125550123')).toBeNull();
  });
});

describe('truncateSmsBody', () => {
  it('leaves a short body alone and caps a long one', () => {
    expect(truncateSmsBody('short')).toBe('short');
    const long = truncateSmsBody('x'.repeat(500));
    expect(long).toHaveLength(320);
    expect(long.endsWith('...')).toBe(true);
  });
});

describe('sms client provider selection', () => {
  it('reports not configured when no provider is set, and sends nothing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await createSmsClient().send({ to: '+14125550123', body: 'hi' });

    expect(result).toMatchObject({ ok: false, error: 'SMS_NOT_CONFIGURED', retryable: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isSmsConfigured()).toBe(false);
  });

  it('honors SMS_DISABLED even when Twilio is fully configured', async () => {
    configureTwilio();
    process.env.SMS_DISABLED = '1';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await createSmsClient().send({ to: '+14125550123', body: 'hi' });

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isSmsConfigured()).toBe(false);
  });

  it('does not treat a partial Twilio configuration as configured', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC00000000000000000000000000000000';
    // No auth token, no from number.
    expect(isSmsConfigured()).toBe(false);
  });
});

describe('twilio send', () => {
  it('posts a form-encoded message and returns the message sid', async () => {
    configureTwilio();
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 201, json: async () => ({ sid: 'SM123' }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createSmsClient().send({ to: '+14125550123', body: 'RayHealth: hello' });

    expect(result).toEqual({ ok: true, id: 'SM123' });
    const [url, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
    expect(url).toContain('/Messages.json');
    expect(init.headers.authorization).toMatch(/^Basic /);
    const form = new URLSearchParams(init.body);
    expect(form.get('To')).toBe('+14125550123');
    expect(form.get('From')).toBe('+14125550000');
    expect(form.get('Body')).toBe('RayHealth: hello');
  });

  it('marks a 4xx as not retryable, since it will fail identically', async () => {
    configureTwilio();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ message: 'bad number' }) }),
    );

    const result = await createSmsClient().send({ to: '+14125550123', body: 'hi' });

    expect(result).toMatchObject({ ok: false, error: 'twilio_400', retryable: false });
  });

  it('marks a 5xx and a rate limit as retryable', async () => {
    configureTwilio();
    for (const status of [500, 429]) {
      resetSmsClient();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({}) }));
      const result = await createSmsClient().send({ to: '+14125550123', body: 'hi' });
      expect(result).toMatchObject({ ok: false, retryable: true });
    }
  });

  it('never throws on a transport failure', async () => {
    configureTwilio();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const result = await createSmsClient().send({ to: '+14125550123', body: 'hi' });

    expect(result).toMatchObject({ ok: false, error: 'transport_failure', retryable: true });
  });

  it('truncates an over-long body before it fans out into multiple messages', async () => {
    configureTwilio();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ sid: 'SM1' }) });
    vi.stubGlobal('fetch', fetchMock);

    await createSmsClient().send({ to: '+14125550123', body: 'y'.repeat(600) });

    const init = fetchMock.mock.calls[0][1] as { body: string };
    expect(new URLSearchParams(init.body).get('Body')).toHaveLength(320);
  });
});
