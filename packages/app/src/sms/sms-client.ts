/**
 * Provider-agnostic SMS client.
 *
 * Shaped like email-client.ts: pick a provider from the environment, fall back
 * to a no-op that reports SMS_NOT_CONFIGURED rather than pretending to have
 * sent. Twilio is called over its REST API with plain fetch so this adds no
 * dependency and no new supply-chain surface.
 *
 * Provider selection (first match wins):
 *   1. Twilio, set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER.
 *   2. No-op fallback (also forced by SMS_DISABLED=1).
 *
 * PHI RULE, and it is stricter here than anywhere else in the codebase: SMS is
 * not a secure channel. Messages traverse carrier infrastructure in the clear,
 * land on a lock screen, and are retained by the carrier outside any BAA we
 * hold. Nothing sent through this client may contain a client name, address,
 * diagnosis, visit detail, or anything else that identifies who is receiving
 * care. Text is a nudge to open the app, never a carrier of content.
 *
 * Sending SMS to a caregiver about their own schedule is employment
 * communication rather than PHI disclosure, which is why the generic bodies
 * assembled by notification-service are acceptable. Anything richer needs a
 * signed BAA with the carrier gateway and a fresh look at §164.502.
 */

import { safeError } from '../security/safe-log.js';

const TWILIO_SEND_TIMEOUT_MS = 15_000;

export interface SmsMessage {
  /** E.164 destination, e.g. +14125550123. */
  to: string;
  /** Generic, non-PHI text. See the module rule above. */
  body: string;
}

export type SmsSendResult =
  | { ok: true; id: string }
  | { ok: false; error: string; retryable: boolean };

export interface SmsClient {
  send(message: SmsMessage): Promise<SmsSendResult>;
}

/**
 * Normalize a stored phone number to E.164, or null when it cannot be.
 *
 * Agency-entered numbers arrive in every shape a human types: "(412)
 * 555-0123", "412.555.0123", "1-412-555-0123". Ten digits are assumed to be
 * North American, since RayHealth operates in PA; eleven starting with 1 are
 * the same number written long. Anything else is left alone if it already
 * looks like E.164, and rejected otherwise rather than guessed at, because a
 * wrong guess texts a stranger.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/** SMS bodies are capped so a nudge never fans out into a multi-part message. */
export function truncateSmsBody(body: string): string {
  return body.length <= 320 ? body : `${body.slice(0, 317)}...`;
}

function createTwilioClient(accountSid: string, authToken: string, from: string): SmsClient {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const authorization = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;

  return {
    async send(message: SmsMessage): Promise<SmsSendResult> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TWILIO_SEND_TIMEOUT_MS);
      try {
        const form = new URLSearchParams({
          To: message.to,
          From: from,
          Body: truncateSmsBody(message.body),
        });
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            authorization,
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
          },
          body: form.toString(),
          signal: controller.signal,
        });
        const parsed = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
        if (!res.ok) {
          // 4xx is a bad number or a configuration problem and will fail again
          // identically; 5xx and 429 are worth another attempt later.
          const retryable = res.status >= 500 || res.status === 429;
          safeError(`twilio send responded ${res.status}`);
          return { ok: false, error: `twilio_${res.status}`, retryable };
        }
        return { ok: true, id: parsed.sid ?? 'unknown' };
      } catch (err) {
        safeError('twilio send failed', err);
        return { ok: false, error: 'transport_failure', retryable: true };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function createNoopClient(): SmsClient {
  return {
    async send(): Promise<SmsSendResult> {
      return { ok: false, error: 'SMS_NOT_CONFIGURED', retryable: false };
    },
  };
}

/**
 * Resolve the SMS client from the environment.
 *
 * SMS_DISABLED=1 forces the no-op, which is how a staging deploy avoids
 * texting real caregivers with test data.
 */
export function createSmsClient(): SmsClient {
  if (process.env.SMS_DISABLED === '1') return createNoopClient();

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (accountSid && authToken && from) {
    return createTwilioClient(accountSid, authToken, from);
  }
  return createNoopClient();
}

let cached: SmsClient | null = null;

/** Process-wide client. Reset with `resetSmsClient()` in tests. */
export function getSmsClient(): SmsClient {
  if (!cached) cached = createSmsClient();
  return cached;
}

export function resetSmsClient(): void {
  cached = null;
}

/** True when a real provider is wired up, for health/readiness reporting. */
export function isSmsConfigured(): boolean {
  return (
    process.env.SMS_DISABLED !== '1' &&
    Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM_NUMBER,
    )
  );
}
