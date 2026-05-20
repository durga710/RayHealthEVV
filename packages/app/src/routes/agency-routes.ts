import { Router } from 'express';
import { AgencyRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';

const router = Router();

/** Return only the authenticated admin's own agency — never cross-agency data. */
router.get('/', requireCapability('agency.read'), async (req, res) => {
  if (req.auth.role !== 'admin') {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  try {
    const agency = await new AgencyRepository(req.app.get('db')).findById(req.auth.agencyId);
    if (!agency) {
      res.status(404).json({ message: 'Agency not found' });
      return;
    }
    res.json([{ id: agency.id, name: agency.name }]);
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
