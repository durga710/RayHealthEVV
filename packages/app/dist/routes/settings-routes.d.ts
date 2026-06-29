/**
 * Account settings — security (TOTP 2FA), active sessions, notification
 * preferences, appearance/locale preferences, data export, and account
 * deletion requests. Mounted under /settings on the authenticated surface,
 * so authContext + requireCsrf are already applied by app.ts.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=settings-routes.d.ts.map