import type { CookieOptions, Request } from 'express';
export declare const SESSION_COOKIE_NAME = "rayhealth_session";
export declare function sessionCookieOptions(): CookieOptions;
export declare function clearSessionCookieOptions(): CookieOptions;
export declare function readCookie(req: Request, name: string): string | undefined;
//# sourceMappingURL=cookies.d.ts.map