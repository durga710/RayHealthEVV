import type { CookieOptions, Request } from 'express';

export const SESSION_COOKIE_NAME = 'rayhealth_session';
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: EIGHT_HOURS_MS
  };
}

export function clearSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  };
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.header('cookie');
  if (!header) return undefined;
  const prefix = `${name}=`;
  return header
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}
