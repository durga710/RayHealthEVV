export const SESSION_COOKIE_NAME = 'rayhealth_session';
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
export function sessionCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        // 'strict' blocks the cookie on cross-site navigations. Web client is
        // same-origin via Vercel rewrites — this is defense-in-depth on top of
        // the explicit CSRF token check.
        sameSite: 'strict',
        path: '/',
        maxAge: EIGHT_HOURS_MS
    };
}
export function clearSessionCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
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