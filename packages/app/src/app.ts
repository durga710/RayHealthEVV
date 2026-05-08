import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import './types.js';
import { authContext } from './middleware/auth-context.js';
import { requireCapability } from './middleware/require-capability.js';
import { auditLog } from './middleware/audit-log.js';
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
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var must be set before starting');

  const app = express();
  const db = createDb();

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173'];

  app.set('db', db);
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json());
  app.use('/auth/login', authLimiter);
  app.use('/auth/bootstrap', authLimiter);
  app.use('/auth', authRoutes);
  app.use(authContext);
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
