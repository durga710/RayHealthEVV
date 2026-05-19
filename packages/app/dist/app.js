import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import './types.js';
import { authContext } from './middleware/auth-context.js';
import { auditLog } from './middleware/audit-log.js';
import { requireCsrf } from './middleware/csrf.js';
import { createDb } from '@rayhealth/core';
import authRoutes from './routes/auth-routes.js';
import healthRoutes, { healthLimiter } from './routes/health-routes.js';
import inviteAcceptanceRoutes from './routes/invite-acceptance-routes.js';
import invitationsRoutes from './routes/invitations-routes.js';
import inviteRoutes from './routes/invite-routes.js';
import agencyRoutes from './routes/agency-routes.js';
import staffRoutes from './routes/staff-routes.js';
import clientRoutes from './routes/client-routes.js';
import authorizationRoutes from './routes/authorization-routes.js';
import templateRoutes from './routes/template-routes.js';
import assignmentRoutes from './routes/assignment-routes.js';
import evvRoutes from './routes/evv-routes.js';
import maintenanceRoutes from './routes/maintenance-routes.js';
import taskRoutes from './routes/task-routes.js';
import auditRetentionRoutes from './routes/audit-retention-routes.js';
import auditEventsRoutes from './routes/audit-events-routes.js';
import learningRoutes from './routes/learning-routes.js';
import adminAssistantRoutes from './routes/admin-assistant-routes.js';
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
/**
 * Default rate limit for the authenticated API surface. 300 requests per
 * 15-minute window per IP is well above legitimate admin/coordinator use
 * (each page load is typically <10 requests) and well below what an
 * exfiltration script with a leaked session would need to drain a database.
 * Tighter per-route limits below for the most expensive surfaces.
 */
const authenticatedDefaultLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
});
/** Audit retention is admin-only; even with a leaked admin session, no
 *  legitimate workflow calls it more than a few times per window. */
const adminAuditLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
});
/**
 * Invite-acceptance rate limit — both the GET (token lookup) and POST
 * (access-code submission). The token in the URL is cryptographically
 * unguessable, but an attacker who phishes a token can still try to
 * brute-force the 8-char access code. 20 attempts per 15-min window
 * per IP is well over what a legitimate user needs (one GET on page
 * load, one POST on submit, maybe a couple of corrections) but well
 * under what a brute-force would need against the ~10^11 access-code
 * keyspace.
 */
const inviteAcceptanceLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many attempts. Try again in 15 minutes.' },
    // Skip rate limiting under vitest — supertest fires from the same IP and the
    // limiter is module-scoped, so the cumulative request count across tests
    // could trip the limit. Production still gets the protection.
    skip: () => process.env.NODE_ENV === 'test',
});
export function createApp() {
    if (!process.env.JWT_SECRET)
        throw new Error('JWT_SECRET env var must be set before starting');
    // Fail closed in production. A missing ALLOWED_ORIGINS in prod silently
    // defaulting to `http://localhost:5173` would let any localhost-only test
    // attacker reach a deployed API; refuse to boot.
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && !process.env.ALLOWED_ORIGINS) {
        throw new Error('ALLOWED_ORIGINS env var must be set in production');
    }
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ??
        ['http://localhost:5173'];
    const app = express();
    const db = createDb();
    app.set('db', db);
    // Behind Vercel / Neon, we sit one proxy hop deep. Trust ONE hop so
    // `req.ip` reflects the real client (used by rate limiters and the
    // ip_address audit field). Trusting all proxies is a spoofing risk.
    app.set('trust proxy', 1);
    // ---------- Security headers (helmet) ----------
    app.use(helmet({
        // HSTS — force HTTPS for one year, including subdomains, and submit
        // to browser preload lists. Only meaningful in production where
        // we're behind HTTPS; harmless in dev.
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
        // The API does not render HTML — strip framing and referrer leakage
        // to the safest defaults.
        frameguard: { action: 'deny' },
        referrerPolicy: { policy: 'no-referrer' },
        // CSP doesn't apply to a pure JSON API but helmet's restrictive
        // default doesn't hurt — it still hardens the rare static error
        // pages Express might serve.
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                defaultSrc: ["'none'"],
                frameAncestors: ["'none'"],
            },
        },
        crossOriginResourcePolicy: { policy: 'same-site' },
    }));
    // ---------- CORS ----------
    app.use(cors({ origin: allowedOrigins, credentials: true }));
    // ---------- Body parsing with explicit size cap ----------
    // 100KB is generous for our payload shapes (invite acceptance, agency
    // config updates, EVV punches) and prevents JSON-bomb DoS. Copilot is
    // smaller (4000-char prompt cap enforced inside the route).
    app.use(express.json({ limit: '100kb' }));
    for (const prefix of ['', '/api']) {
        app.use(`${prefix}/auth/login`, authLimiter);
        app.use(`${prefix}/auth/mobile/login`, authLimiter);
        app.use(`${prefix}/auth/bootstrap`, authLimiter);
        app.use(`${prefix}/auth`, authRoutes);
        // Public invite-acceptance endpoints — mounted before authContext so a
        // caregiver clicking the email link can hit them without a session.
        // Rate-limited to dampen access-code brute-force.
        app.use(`${prefix}/invites/accept`, inviteAcceptanceLimiter, inviteAcceptanceRoutes);
        // Public invitation lookup + accept (newer surface; same rate-limit
        // category as the legacy /invites/accept endpoint).
        app.use(`${prefix}/invitations`, inviteAcceptanceLimiter, invitationsRoutes);
        // Public health endpoints (liveness, DB, audit-pipeline). Unauthenticated
        // on purpose — the public /status page polls these. Mounted BEFORE
        // authContext, behind their own tighter rate limit (60 / 15-min per IP).
        app.use(`${prefix}/health`, healthLimiter, healthRoutes);
    }
    // ---------- Authenticated surface ----------
    // Default limiter applies to every authenticated route; per-route
    // limiters below override with tighter caps where the cost is higher.
    app.use(authContext);
    app.use(authenticatedDefaultLimiter);
    app.use(requireCsrf);
    app.use(auditLog);
    for (const prefix of ['', '/api']) {
        app.use(`${prefix}/invites`, inviteRoutes);
        app.use(`${prefix}/agencies`, agencyRoutes);
        app.use(`${prefix}/staff`, staffRoutes);
        app.use(`${prefix}/clients`, clientRoutes);
        app.use(`${prefix}/authorizations`, authorizationRoutes);
        app.use(`${prefix}/templates`, templateRoutes);
        app.use(`${prefix}/assignments`, assignmentRoutes);
        app.use(`${prefix}/evv`, evvRoutes);
        app.use(`${prefix}/maintenance`, maintenanceRoutes);
        app.use(`${prefix}/tasks`, taskRoutes);
        app.use(`${prefix}/admin/audit-retention`, adminAuditLimiter, auditRetentionRoutes);
        app.use(`${prefix}/admin/audit-events`, adminAuditLimiter, auditEventsRoutes);
        app.use(`${prefix}/learning`, learningRoutes);
        app.use(`${prefix}/admin-assistant`, adminAssistantRoutes);
    }
    return app;
}
//# sourceMappingURL=app.js.map