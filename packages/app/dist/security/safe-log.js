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
const REDACTIONS = [
    // Medicaid IDs (PA: 10 digits). Conservative — strips any 10-11 digit run.
    { pattern: /\b\d{10,11}\b/g, replacement: '[REDACTED-MEDICAID]' },
    // SSN-shaped XXX-XX-XXXX or 9 raw digits.
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED-SSN]' },
    { pattern: /\b\d{9}\b/g, replacement: '[REDACTED-9DIGIT]' },
    // JWTs (eyJ + three base64url segments).
    { pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, replacement: '[REDACTED-JWT]' },
    // password / passwordHash / token / secret / privateKey JSON or assignment.
    {
        pattern: /(password(?:[_-]?hash)?|token|secret|privateKey|api[_-]?key)[\s"':=]+["']?[^"',\s)]+/gi,
        replacement: '$1=[REDACTED]'
    },
    // PEM private keys.
    {
        pattern: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
        replacement: '[REDACTED-PEM]'
    }
];
function scrub(value) {
    if (!value)
        return value;
    let out = value;
    for (const { pattern, replacement } of REDACTIONS)
        out = out.replace(pattern, replacement);
    return out;
}
function shape(error) {
    if (!error)
        return { name: 'Unknown' };
    if (error instanceof Error) {
        return {
            name: error.name,
            message: scrub(error.message),
            stack: process.env.NODE_ENV === 'production' ? undefined : scrub(error.stack),
            code: error.code
        };
    }
    if (typeof error === 'object') {
        const e = error;
        return {
            name: typeof e.name === 'string' ? e.name : 'Object',
            message: typeof e.message === 'string' ? scrub(e.message) : undefined,
            code: e.code ?? undefined
        };
    }
    return { name: 'Primitive', message: scrub(String(error)) };
}
export function safeError(msg, error) {
    if (process.env.NODE_ENV === 'test')
        return;
    console.error(JSON.stringify({ level: 'error', msg: scrub(msg), error: shape(error) }));
}
export function safeWarn(msg, error) {
    if (process.env.NODE_ENV === 'test')
        return;
    console.warn(JSON.stringify({ level: 'warn', msg: scrub(msg), error: shape(error) }));
}
//# sourceMappingURL=safe-log.js.map