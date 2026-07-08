/**
 * Shared-secret authorization for cron-invoked endpoints.
 *
 * Vercel Cron calls scheduled paths with `Authorization: Bearer <CRON_SECRET>`
 * (the project env var). Routes that accept cron invocation call this first
 * and typically fall back to a human capability check so a privileged admin
 * can trigger a manual run from a session.
 */
import type { Request } from 'express';

export function assertCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice('Bearer '.length).trim();
  // Constant-time compare not strictly required here (secret is per-deployment),
  // but harmless and avoids a class of timing-attack false positives.
  if (token.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diff === 0;
}
