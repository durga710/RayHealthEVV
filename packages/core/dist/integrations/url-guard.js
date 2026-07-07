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
function ipv4IsBlocked(host) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!m)
        return false;
    const o = m.slice(1).map(Number);
    if (o.some((n) => n > 255))
        return true; // malformed → treat as unsafe
    const [a, b] = o;
    if (a === 127)
        return true; // 127.0.0.0/8 loopback
    if (a === 10)
        return true; // 10.0.0.0/8 private
    if (a === 172 && b >= 16 && b <= 31)
        return true; // 172.16.0.0/12 private
    if (a === 192 && b === 168)
        return true; // 192.168.0.0/16 private
    if (a === 169 && b === 254)
        return true; // 169.254.0.0/16 link-local (incl. cloud metadata)
    if (a === 0)
        return true; // 0.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127)
        return true; // 100.64.0.0/10 CGNAT
    return false;
}
function ipv6IsBlocked(host) {
    const h = host.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
    if (h === '::1' || h === '::')
        return true; // loopback / unspecified
    if (h.startsWith('fe80'))
        return true; // link-local
    if (h.startsWith('fc') || h.startsWith('fd'))
        return true; // unique-local fc00::/7
    // IPv4-mapped (e.g. ::ffff:127.0.0.1) — extract and re-check the v4 tail.
    const mapped = /::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
    if (mapped && ipv4IsBlocked(mapped[1]))
        return true;
    return false;
}
/** True when a hostname/IP literal must not be reached from the server. */
export function isBlockedOutboundHost(hostname) {
    const host = hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost'))
        return true;
    if (host === '')
        return true;
    return ipv4IsBlocked(host) || ipv6IsBlocked(host);
}
/**
 * True when `value` is an https URL whose host is not a blocked
 * (loopback/private/link-local/localhost) target. Returns false for any parse
 * failure, non-https scheme, or blocked host.
 */
export function isSafeOutboundUrl(value) {
    let url;
    try {
        url = new URL(value);
    }
    catch {
        return false;
    }
    if (url.protocol !== 'https:')
        return false;
    return !isBlockedOutboundHost(url.hostname);
}
/** Throws when `value` is not a safe outbound URL — for use right before a fetch. */
export function assertSafeOutboundUrl(value) {
    if (!isSafeOutboundUrl(value)) {
        throw new Error('refusing to call a non-https or private/internal URL');
    }
}
//# sourceMappingURL=url-guard.js.map