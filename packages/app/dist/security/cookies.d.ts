import type { CookieOptions, Request } from 'express';
export declare const SESSION_COOKIE_NAME = "rayhealth_session";
export declare const PLATFORM_COOKIE_NAME = "rayhealth_platform";
/**
 * Cookie for the platform super-admin token. httpOnly so an XSS anywhere in the
 * SPA cannot read the highest-privilege credential in the system (it must never
 * live in JS-readable storage). SameSite=strict is the CSRF defense for the
 * hidden console — cross-site requests never carry it. maxAge matches the 2h
 * platform-token expiry.
 */
export declare function platformCookieOptions(): CookieOptions;
export declare function clearPlatformCookieOptions(): CookieOptions;
export declare function sessionCookieOptions(): CookieOptions;
export declare function clearSessionCookieOptions(): CookieOptions;
export declare function readCookie(req: Request, name: string): string | undefined;
//# sourceMappingURL=cookies.d.ts.map