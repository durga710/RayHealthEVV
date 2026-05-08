import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { EvvRepository } from '@rayhealth/core';

const router = Router();

router.get('/visits', requireCapability('schedule.read'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new EvvRepository(db);
    // Caregivers see only their own visits. Admin / coordinator / family
    // get the agency scope. Tenant isolation is enforced inside the repo
    // via JOIN on users.agency_id.
    const visits =
      req.auth.role === 'caregiver' && req.auth.caregiverId
        ? await repo.getVisitsForCaregiver(req.auth.caregiverId)
        : await repo.getVisitsForAgency(req.auth.agencyId);
    res.json(visits);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/clock-in', requireCapability('schedule.write'), async (req, res) => {
  try {
    if (!req.auth.caregiverId) return res.status(403).json({ message: 'User is not authorized as a caregiver' });
    const db = req.app.get('db');
    const repo = new EvvRepository(db);
    const visit = await repo.createVisit({
      assignmentId: req.body.assignmentId,
      caregiverId: req.auth.caregiverId,
      clockInTime: new Date().toISOString(),
      clockInLocation: req.body.location,
      status: 'pending'
    });
    res.status(201).json(visit);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/clock-out/:id', requireCapability('schedule.write'), async (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const db = req.app.get('db');
    const repo = new EvvRepository(db);
    // updateVisit returns null when the visit is on another tenant OR does
    // not exist. Both surface as 404 — we never confirm cross-tenant existence.
    const visit = await repo.updateVisit(id, req.auth.agencyId, {
      clockOutTime: new Date().toISOString(),
      clockOutLocation: req.body.location,
      status: 'verified'
    });
    if (!visit) return res.status(404).json({ message: 'Visit not found' });
    res.json(visit);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;