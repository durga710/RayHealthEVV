/**
 * Platform super-admin console (hidden; outside agency tenancy).
 *
 *   POST /superadmin/login                     — username + password → platform JWT
 *   GET  /superadmin/agencies                  — every agency + review status
 *   POST /superadmin/agencies/:id/approve      — approve a signup
 *   POST /superadmin/agencies/:id/reject       — reject (and lock out) a signup
 *   GET  /superadmin/users                     — every user across all agencies
 *   POST /superadmin/users/:id/suspend         — terminate (disable) an account
 *   POST /superadmin/users/:id/reactivate      — restore a suspended account
 *
 * Mounted BEFORE authContext: the super-admin authenticates with its own
 * bearer JWT (scope:'platform'), never an agency cookie/session. Credentials
 * come from env (SUPER_ADMIN_USERNAME + SUPER_ADMIN_PASSWORD_HASH, a bcrypt
 * hash) — the plaintext password is never stored in source or the DB. If those
 * env vars are unset the login endpoint returns 503 (feature disabled).
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=superadmin-routes.d.ts.map