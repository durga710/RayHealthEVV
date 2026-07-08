/**
 * Generic HTTPS clearinghouse transport.
 *
 * Matches the common REST shape: POST the raw 837 text and receive a
 * reference id; GET a remittance path and receive `{ files: [{name,
 * content}] }`. Real clearinghouse APIs vary; agency-specific dialects can be
 * added later as named transports behind the same interface.
 *
 * Security: the endpoint is asserted safe (public https) immediately before
 * every request, auth headers are built from decrypted credentials that never
 * appear in messages, and upstream response bodies are never reflected into
 * our error messages (anti reflected-SSRF, same posture as the Sandata
 * client).
 */
import { createHash } from 'crypto';
import { basicAuth, getJson, postText } from './http.js';
import { assertSafeOutboundUrl } from './url-guard.js';
import type {
  ClearinghouseTransport,
  TransportFetchResult,
  TransportSubmitResult,
  TransportTestResult,
} from './clearinghouse-transport.js';

export interface HttpTransportInput {
  endpoint: string;
  credentials: Record<string, string | undefined>;
  settings: Record<string, unknown>;
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function authHeaders(credentials: Record<string, string | undefined>): Record<string, string> {
  if (credentials.apiKey) return { authorization: `Bearer ${credentials.apiKey}` };
  if (credentials.username && credentials.password) {
    return { authorization: basicAuth(credentials.username, credentials.password) };
  }
  return {};
}

/** Regex-free trailing-slash strip (config strings are admin input). */
function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') end -= 1;
  return value.slice(0, end);
}

function joinUrl(base: string, path: string): string {
  const cleanBase = stripTrailingSlashes(base);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

function settingString(settings: Record<string, unknown>, key: string, fallback: string): string {
  const value = settings[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function createHttpClearinghouseTransport(input: HttpTransportInput): ClearinghouseTransport {
  const headers = authHeaders(input.credentials);
  const submitUrl = joinUrl(input.endpoint, settingString(input.settings, 'submitPath', '/claims'));
  const remitUrl = joinUrl(input.endpoint, settingString(input.settings, 'remittancePath', '/remittances'));

  return {
    name: 'http',

    async submit(edi837, meta): Promise<TransportSubmitResult> {
      try {
        assertSafeOutboundUrl(submitUrl);
        const res = await postText(submitUrl, edi837, {
          contentType: 'application/edi-x12',
          headers,
        });
        if (res.ok) {
          const body = res.body as { reference?: unknown; id?: unknown } | undefined;
          const reference =
            (typeof body?.reference === 'string' && body.reference) ||
            (typeof body?.id === 'string' && body.id) ||
            `HTTP-${res.status}-${Math.floor(Date.now() / 1000)}`;
          return { kind: 'ok', reference };
        }
        if (res.status === 401 || res.status === 403) {
          return { kind: 'error', message: 'Clearinghouse rejected our credentials', retryable: false };
        }
        if (res.status >= 500) {
          return { kind: 'error', message: `Clearinghouse service error (HTTP ${res.status})`, retryable: true };
        }
        return {
          kind: 'error',
          message: `Clearinghouse rejected the submission (HTTP ${res.status})`,
          retryable: false,
        };
      } catch {
        // Refused-by-guard or network failure. Never reflect details upstream.
        return { kind: 'error', message: `Could not reach the clearinghouse to submit claim ${meta.controlNumber}`, retryable: true };
      }
    },

    async fetchRemittances({ maxFiles }): Promise<TransportFetchResult> {
      try {
        assertSafeOutboundUrl(remitUrl);
        const res = await getJson(remitUrl, { headers });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            return { kind: 'error', message: 'Clearinghouse rejected our credentials', retryable: false };
          }
          return { kind: 'error', message: `Clearinghouse service error (HTTP ${res.status})`, retryable: res.status >= 500 };
        }
        const body = res.body as { files?: Array<{ name?: unknown; content?: unknown }> } | undefined;
        const raw = Array.isArray(body?.files) ? body.files : [];
        const files = raw
          .filter((f) => typeof f?.name === 'string' && typeof f?.content === 'string')
          .slice(0, maxFiles)
          .map((f) => {
            const content = f.content as string;
            return { name: f.name as string, content, sha256: sha256Hex(content) };
          });
        return { kind: 'ok', files };
      } catch {
        return { kind: 'error', message: 'Could not reach the clearinghouse to fetch remittances', retryable: true };
      }
    },

    async testConnection(): Promise<TransportTestResult> {
      try {
        assertSafeOutboundUrl(input.endpoint);
        const res = await getJson(input.endpoint, { headers, timeoutMs: 10_000 });
        if (res.status >= 500) {
          return { kind: 'error', message: `Clearinghouse service error (HTTP ${res.status})`, retryable: true };
        }
        return { kind: 'ok', detail: `Endpoint reachable (HTTP ${res.status})` };
      } catch {
        return { kind: 'error', message: 'Could not reach the clearinghouse endpoint', retryable: true };
      }
    },
  };
}
