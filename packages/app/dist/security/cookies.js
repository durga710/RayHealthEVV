export const SESSION_COOKIE_NAME = 'rayhealth_session';
export const PLATFORM_COOKIE_NAME = 'rayhealth_platform';
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
/**
 * Cookie for the platform super-admin token. httpOnly so an XSS anywhere in the
 * SPA cannot read the highest-privilege credential in the system (it must never
 * live in JS-readable storage). SameSite=strict is the CSRF defense for the
 * hidden console — cross-site requests never carry it. maxAge matches the 2h
 * platform-token expiry.
 */
export function platformCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: TWO_HOURS_MS,
    };
}
export function clearPlatformCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
    };
}
export function sessionCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        // strict, not lax — the admin UI never receives top-level navigations
        // from third-party origins as part of a real flow. Strict prevents
        // even GET-based CSRF on the rare auth-sensitive read endpoints.
        sameSite: 'strict',
        path: '/',
        maxAge: EIGHT_HOURS_MS
    };
}
export function clearSessionCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        // strict, not lax — the admin UI never receives top-level navigations
        // from third-party origins as part of a real flow. Strict prevents
        // even GET-based CSRF on the rare auth-sensitive read endpoints.
        sameSite: 'strict',
        path: '/'
    };
}
export function readCookie(req, name) {
    const header = req.header('cookie');
    if (!header)
        return undefined;
    const prefix = `${name}=`;
    return header
        .split(';')
        .map((value) => value.trim())
        .find((value) => value.startsWith(prefix))
        ?.slice(prefix.length);
}
//# sourceMappingURL=cookies.js.map