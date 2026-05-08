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
export function createApp() {
    if (!process.env.JWT_SECRET)
        throw new Error('JWT_SECRET env var must be set before starting');
    const app = express();
    const db = createDb();
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173'];
    app.set('db', db);
    app.disable('x-powered-by');
    // helmet must come BEFORE routes so its security headers attach to every response,
    // including 4xx/5xx error paths from rate-limit / cors / parse failures.
    app.use(helmet({
        // API is JSON only; no inline scripts / styles to whitelist.
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        // HSTS is meaningful only when served over HTTPS; Vercel terminates TLS,
        // so the prod proxy will always be https.
        hsts: { maxAge: 15552000, includeSubDomains: true, preload: false },
        referrerPolicy: { policy: 'no-referrer' }
    }));
    app.use(cors({ origin: allowedOrigins, credentials: true }));
    app.use(express.json({ limit: '256kb' }));
    app.use('/auth/login', authLimiter);
    app.use('/auth/mobile/login', authLimiter);
    app.use('/auth/bootstrap', authLimiter);
    app.use('/auth', authRoutes);
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
    // Protected route for testing (keep for now or remove if redundant)
    app.get('/agencies/current-test', requireCapability('agency.read'), (req, res) => {
        res.json({ id: req.auth.agencyId, name: 'Current Agency' });
    });
    return app;
}
//# sourceMappingURL=app.js.map