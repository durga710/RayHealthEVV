import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import './types.js';
import { authContext } from './middleware/auth-context.js';
import { requireCapability } from './middleware/require-capability.js';
import { auditLog } from './middleware/audit-log.js';
import { requireCsrf } from './middleware/csrf.js';
import { createDb } from '@rayhealth/core';

import authRoutes from './routes/auth-routes.js';
import marketingRoutes from './routes/marketing-routes.js';
import supportRoutes from './routes/support-routes.js';
import exportRoutes from './routes/export-routes.js';
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

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
// Marketing /contact accepts anonymous POSTs — be more generous than auth
// (legitimate users may type slowly + retry once on a 5xx) but still cap.
const marketingLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
// Support /chat is more chatty by nature — allow a real conversation
// (~30 turns/hr) per IP. Spam-control without throttling real visitors.
const supportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

export function createApp() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var must be set before starting');

  const app = express();
  const db = createDb();

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173'];

  app.set('db', db);
  app.disable('x-powered-by');
  // Trust Vercel's edge proxy so req.ip resolves to the real client IP from
  // X-Forwarded-For instead of 127.0.0.1. Exactly 1 hop — never `true` (that
  // trusts any number of hops and lets a caller spoof X-Forwarded-For).
  app.set('trust proxy', 1);
  // helmet must come BEFORE routes so its security headers attach to every response,
  // including 4xx/5xx error paths from rate-limit / cors / parse failures.
  app.use(
    helmet({
      // API is JSON only; no inline scripts / styles to whitelist.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      // HSTS is meaningful only when served over HTTPS; Vercel terminates TLS,
      // so the prod proxy will always be https.
      hsts: { maxAge: 15552000, includeSubDomains: true, preload: false },
      referrerPolicy: { policy: 'no-referrer' }
    })
  );
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '256kb' }));
  // Public liveness probe. Returns 200 + JSON without touching DB or auth.
  // For deeper readiness use /api/auth/me (which is auth-gated). Keep this
  // route ABOVE authContext so uptime monitors don't need credentials.
  app.get('/health', (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString() });
  });

  app.use('/auth/login', authLimiter);
  app.use('/auth/mobile/login', authLimiter);
  app.use('/auth/bootstrap', authLimiter);
  app.use('/auth', authRoutes);
  // Marketing routes are public — mount BEFORE authContext.
  app.use('/marketing', marketingLimiter, marketingRoutes);
  app.use('/support', supportLimiter, supportRoutes);
  app.use(authContext);
  app.use(requireCsrf);
  app.use(auditLog);

  app.use('/invites', inviteRoutes);
  app.use('/agencies', agencyRoutes);
  app.use('/staff', staffRoutes);
  app.use('/clients', clientRoutes);
  app.use('/authorizations', authorizationRoutes);
  app.use('/templates', templateRoutes);
  app.use('/assignments', assignmentRoutes);
  app.use('/evv', evvRoutes);
  app.use('/maintenance', maintenanceRoutes);
  app.use('/tasks', taskRoutes);
  app.use('/exports', exportRoutes);

  // Protected route for testing (keep for now or remove if redundant)
  app.get('/agencies/current-test', requireCapability('agency.read'), (req, res) => {
    res.json({ id: req.auth.agencyId, name: 'Current Agency' });
  });

  return app;
}
