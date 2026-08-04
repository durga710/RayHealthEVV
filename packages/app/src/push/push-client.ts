/**
 * Server-driven push notifications.
 *
 * Delivery goes through the Expo Push Service, which fronts APNs and FCM and
 * is what the managed Expo app is already built against. No credential is
 * required for basic sending; set EXPO_ACCESS_TOKEN to enable Expo's
 * additional send-side verification.
 *
 * Provider selection (first match wins), mirroring email-client.ts:
 *   1. Expo Push Service, unless disabled.
 *   2. No-op fallback (PUSH_DISABLED=1, or a non-production run), which
 *      reports NOT_CONFIGURED rather than pretending to have sent.
 *
 * PHI RULE: a push notification renders on a locked screen, in front of
 * whoever is holding the phone. Nothing here may carry client names,
 * addresses, diagnoses, or visit detail. Titles and bodies are generic
 * ("Your next shift starts soon") and the payload carries only ids the app
 * uses to route to the right screen after the caregiver unlocks and
 * authenticates. sanitizePushMessage enforces the shape; keeping the content
 * generic is the caller's responsibility.
 */

import { safeError } from '../security/safe-log.js';

/** Expo's documented per-request batch ceiling. */
const EXPO_BATCH_SIZE = 100;
const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const SEND_TIMEOUT_MS = 15_000;

export interface PushMessage {
  /** Expo push tokens. Batched internally, callers need not chunk. */
  tokens: string[];
  title: string;
  body: string;
  /** Routing hints only. Never PHI. */
  data?: Record<string, string>;
  /** Android channel id, e.g. the existing shift-alert channel. */
  channelId?: string;
  sound?: 'default' | null;
}

export interface PushSendResult {
  /** Tokens the push service accepted for delivery. */
  sent: number;
  /** Tokens the push service rejected outright. */
  failed: number;
  /**
   * Tokens the service reports as permanently dead (DeviceNotRegistered).
   * The caller retires these so we stop paying to notify a deleted app.
   */
  invalidTokens: string[];
  /** Set when nothing was attempted because no provider is configured. */
  notConfigured?: boolean;
}

export interface PushClient {
  send(message: PushMessage): Promise<PushSendResult>;
}

const EMPTY: PushSendResult = { sent: 0, failed: 0, invalidTokens: [] };

/**
 * Trim a message to what is safe to put on a lock screen. Long bodies are
 * truncated (the OS truncates anyway) and data values are coerced to strings,
 * since Expo rejects nested objects.
 */
export function sanitizePushMessage(message: PushMessage): PushMessage {
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(message.data ?? {})) {
    if (value == null) continue;
    data[key] = String(value).slice(0, 256);
  }
  return {
    ...message,
    title: message.title.slice(0, 100),
    body: message.body.slice(0, 240),
    data,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface ExpoTicket {
  status?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * One Expo send request. Never throws: a push is a best-effort courtesy and
 * must not take down the request that triggered it.
 */
async function postToExpo(
  payload: unknown,
  accessToken: string | undefined,
): Promise<{ tickets: ExpoTicket[]; transportFailed: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(EXPO_SEND_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      safeError(`expo push responded ${res.status}`);
      return { tickets: [], transportFailed: true };
    }
    const parsed = (await res.json()) as { data?: ExpoTicket[] };
    return { tickets: Array.isArray(parsed.data) ? parsed.data : [], transportFailed: false };
  } catch (err) {
    safeError('expo push send failed', err);
    return { tickets: [], transportFailed: true };
  } finally {
    clearTimeout(timer);
  }
}

function createExpoClient(accessToken: string | undefined): PushClient {
  return {
    async send(raw: PushMessage): Promise<PushSendResult> {
      const message = sanitizePushMessage(raw);
      const tokens = message.tokens.filter((t) => typeof t === 'string' && t.length > 0);
      if (tokens.length === 0) return { ...EMPTY };

      const result: PushSendResult = { sent: 0, failed: 0, invalidTokens: [] };

      for (const batch of chunk(tokens, EXPO_BATCH_SIZE)) {
        const payload = batch.map((to) => ({
          to,
          title: message.title,
          body: message.body,
          data: message.data,
          sound: message.sound === null ? undefined : (message.sound ?? 'default'),
          ...(message.channelId ? { channelId: message.channelId } : {}),
        }));

        const { tickets, transportFailed } = await postToExpo(payload, accessToken);
        if (transportFailed) {
          result.failed += batch.length;
          continue;
        }

        // Tickets come back positionally aligned with the batch we sent.
        batch.forEach((token, index) => {
          const ticket = tickets[index];
          if (!ticket || ticket.status === 'ok') {
            result.sent += 1;
            return;
          }
          result.failed += 1;
          if (ticket.details?.error === 'DeviceNotRegistered') {
            result.invalidTokens.push(token);
          }
        });
      }

      return result;
    },
  };
}

function createNoopClient(): PushClient {
  return {
    async send(): Promise<PushSendResult> {
      return { ...EMPTY, notConfigured: true };
    },
  };
}

/**
 * Resolve the push client from the environment.
 *
 * PUSH_DISABLED=1 forces the no-op, which is how a staging deploy avoids
 * buzzing real phones with test data.
 */
export function createPushClient(): PushClient {
  if (process.env.PUSH_DISABLED === '1') return createNoopClient();
  return createExpoClient(process.env.EXPO_ACCESS_TOKEN);
}

let cached: PushClient | null = null;

/** Process-wide client. Reset with `resetPushClient()` in tests. */
export function getPushClient(): PushClient {
  if (!cached) cached = createPushClient();
  return cached;
}

export function resetPushClient(): void {
  cached = null;
}
