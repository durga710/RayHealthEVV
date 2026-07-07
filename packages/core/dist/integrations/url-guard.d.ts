/**
 * SSRF guard for agency-configurable outbound URLs (Sandata / HHAeXchange
 * aggregator base URLs). A tenant admin is an authenticated-but-untrusted
 * tenant→infrastructure boundary: without this guard they could point an
 * aggregator base URL at `http://169.254.169.254/…` or an internal host and
 * have the server make requests the tenant itself cannot reach.
 *
 * The check is synchronous and literal-only (no DNS resolution) so it is safe
 * to run in request handlers and unit tests: it enforces https and blocks
 * loopback / private / link-local / unique-local IP literals and localhost
 * hostnames. Request-time DNS-rebinding is out of scope here — the primary
 * control is refusing to STORE a dangerous URL at config-write time.
 */
/** True when a hostname/IP literal must not be reached from the server. */
export declare function isBlockedOutboundHost(hostname: string): boolean;
/**
 * True when `value` is an https URL whose host is not a blocked
 * (loopback/private/link-local/localhost) target. Returns false for any parse
 * failure, non-https scheme, or blocked host.
 */
export declare function isSafeOutboundUrl(value: string): boolean;
/** Throws when `value` is not a safe outbound URL — for use right before a fetch. */
export declare function assertSafeOutboundUrl(value: string): void;
//# sourceMappingURL=url-guard.d.ts.map