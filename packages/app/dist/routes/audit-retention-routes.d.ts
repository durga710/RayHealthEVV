/**
 * Audit retention routes.
 *
 *   GET  /admin/audit-retention/status  — admin-only, returns counts and floor info
 *   POST /admin/audit-retention/sweep   — cron-callable sweep trigger
 *
 * The sweep endpoint is authenticated via a shared secret in the
 * Authorization header (Bearer <CRON_SECRET>) — Vercel Cron sets this
 * automatically. Falls back to admin capability check if the secret is
 * not configured, so a human admin can trigger a manual run from a
 * privileged session.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=audit-retention-routes.d.ts.map