import { Router } from 'express';
import { AgencyRepository, SessionRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { requireCsrf } from '../middleware/csrf.js';

const router = Router();

/** List all agencies — only admin role can use this (platform-wide view). */
router.get('/', requireCapability('agency.read'), async (req, res) => {
  if (req.auth.role !== 'admin') {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  try {
    const agencies = await new AgencyRepository(req.app.get('db')).findAll();
    res.json(agencies.map((a) => ({ id: a.id, name: a.name })));
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * Switch the admin's active agency for this session.
 * All subsequent requests use the switched agency's data scope until
 * the session expires or the admin switches again.
 */
router.patch('/switch', requireCapability('agency.read'), requireCsrf, async (req, res) => {
  if (req.auth.role !== 'admin') {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  if (!req.auth.sessionId) {
    res.status(400).json({ message: 'Session-based auth required for agency switch' });
    return;
  }
  const agencyId = typeof req.body?.agencyId === 'string' ? req.body.agencyId : null;
  if (!agencyId) {
    res.status(400).json({ message: 'agencyId is required' });
    return;
  }
  try {
    const db = req.app.get('db');
    const agencyRepo = new AgencyRepository(db);
    const agency = await agencyRepo.findById(agencyId);
    if (!agency) {
      res.status(404).json({ message: 'Agency not found' });
      return;
    }
    await new SessionRepository(db).switchAgency(req.auth.sessionId, agencyId);
    const agencyTheme = await agencyRepo.findTheme(agencyId).catch(() => null);
    res.json({ agencyId: agency.id, agencyName: agency.name, agencyTheme });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/current', requireCapability('agency.read'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const agency = await new AgencyRepository(db).findById(req.auth.agencyId);
    if (!agency) {
      res.status(404).json({ message: 'Agency not found' });
      return;
    }
    res.json({ id: agency.id, name: agency.name, state: agency.state });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.put('/current', requireCapability('agency.write'), async (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ message: 'name is required' });
    return;
  }
  if (name.trim().length > 200) {
    res.status(400).json({ message: 'name must be 200 characters or fewer' });
    return;
  }
  try {
    const db = req.app.get('db');
    const updated = await new AgencyRepository(db).updateName(req.auth.agencyId, name);
    if (!updated) {
      res.status(404).json({ message: 'Agency not found' });
      return;
    }
    res.json({ id: updated.id, name: updated.name, state: updated.state });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
