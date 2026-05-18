import express from 'express';
import cors from 'cors';
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
import learningRoutes from './routes/learning-routes.js';
import taskRoutes from './routes/task-routes.js';
import auditRetentionRoutes from './routes/audit-retention-routes.js';

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

export function createApp() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var must be set before starting');

  const app = express();
  const db = createDb();

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173'];

  app.set('db', db);
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());
  for (const prefix of ['', '/api']) {
    app.use(`${prefix}/auth/login`, authLimiter);
    app.use(`${prefix}/auth/mobile/login`, authLimiter);
    app.use(`${prefix}/auth/bootstrap`, authLimiter);
    app.use(`${prefix}/auth`, authRoutes);
  }
  app.use(authContext);
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
    app.use(`${prefix}/learning`, learningRoutes);
    app.use(`${prefix}/tasks`, taskRoutes);
    app.use(`${prefix}/admin/audit-retention`, auditRetentionRoutes);
  }

  // Protected route for testing (keep for now or remove if redundant)
  app.get('/agencies/current-test', requireCapability('agency.read'), (req, res) => {
    res.json({ id: req.auth.agencyId, name: 'Current Agency' });
  });

  return app;
}
