/**
 * Server-side error logger that redacts likely PHI / secrets before emitting.
 *
 * Why: a healthcare-review finding flagged that several routes call
 * `console.error('msg', error)` with the raw Error object. Errors thrown by
 * the Postgres driver, fetch clients, or the JSON body parser routinely
 * embed column values, query fragments, or request body fields in `.message`
 * or `.stack`. Logging that raw to stdout puts PHI into the deploy provider's
 * log pipeline — out-of-band from `audit_events` and outside the BAA scope
 * of the application database.
 *
 * Strategy:
 *  - Always emit a stable JSON shape: `{level, msg, error: {name, message, code}}`.
 *  - Scrub `message` / `stack` against high-risk patterns (Medicaid, SSN, JWT,
 *    password / token / secret keys, PEM private keys).
 *  - Drop full stack in production. In dev, keep it but scrubbed.
 *  - Never log the request body.
 *
 * This is a guard-rail for legacy `console.error(rawError)` sites. It is not
 * a structured-logger replacement.
 */
export declare function safeError(msg: string, error?: unknown): void;
export declare function safeWarn(msg: string, error?: unknown): void;
//# sourceMappingURL=safe-log.d.ts.map