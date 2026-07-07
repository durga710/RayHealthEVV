/**
 * Minimal fetch-based JSON transport for trading-partner integrations.
 *
 * Uses the global `fetch` (Node 18+/22) so tests can stub it with
 * `vi.stubGlobal('fetch', ...)`. Applies a hard timeout via AbortController so a
 * hung aggregator can never wedge a request handler. Never throws on a non-2xx
 * status, the caller inspects `ok`/`status` and decides; only a genuine
 * network/abort failure rejects.
 */

export interface HttpJsonResponse {
  status: number;
  ok: boolean;
  /** Parsed JSON body, or undefined if the response was empty / not JSON. */
  body: unknown;
  /** Raw response text (useful for non-JSON error bodies). */
  text: string;
}

export interface PostJsonOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export async function postJson(
  url: string,
  payload: unknown,
  options: PostJsonOptions = {},
): Promise<HttpJsonResponse> {
  const { headers = {}, timeoutMs = 20_000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }
    return { status: res.status, ok: res.ok, body, text };
  } finally {
    clearTimeout(timer);
  }
}

export interface GetJsonOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * GET a JSON resource. Like `postJson`, never throws on a non-2xx status, the
 * caller inspects `ok`/`status`. Only a network/abort failure rejects.
 */
export async function getJson(url: string, options: GetJsonOptions = {}): Promise<HttpJsonResponse> {
  const { headers = {}, timeoutMs = 20_000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json', ...headers },
      signal: controller.signal,
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }
    return { status: res.status, ok: res.ok, body, text };
  } finally {
    clearTimeout(timer);
  }
}

/** Build an HTTP Basic auth header value from a username/password pair. */
export function basicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;
}
