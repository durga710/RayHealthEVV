/**
 * Minimal fetch-based JSON transport for trading-partner integrations.
 *
 * Uses the global `fetch` (Node 18+/22) so tests can stub it with
 * `vi.stubGlobal('fetch', ...)`. Applies a hard timeout via AbortController so a
 * hung aggregator can never wedge a request handler. Never throws on a non-2xx
 * status — the caller inspects `ok`/`status` and decides; only a genuine
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
export declare function postJson(url: string, payload: unknown, options?: PostJsonOptions): Promise<HttpJsonResponse>;
/** Build an HTTP Basic auth header value from a username/password pair. */
export declare function basicAuth(username: string, password: string): string;
//# sourceMappingURL=http.d.ts.map