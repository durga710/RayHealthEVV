import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import {
  EvvRepository,
  ScheduleRepository,
  evvClockInInputSchema,
  evvClockOutInputSchema,
  evvServiceCodeSchema,
  evvVisitIdSchema
} from '@rayhealth/core';

const router = Router();

router.get('/visits', requireCapability('evv.read'), async (req, res) => {
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

router.post('/clock-in', requireCapability('evv.write'), async (req, res) => {
  try {
    if (!req.auth.caregiverId) return res.status(403).json({ message: 'User is not authorized as a caregiver' });

    const parsed = evvClockInInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: 'Valid assignmentId and GPS location are required' });

    const db = req.app.get('db');
    const repo = new EvvRepository(db);
    const scheduleRepo = new ScheduleRepository(db);
    // Resolve client_id (Cures-Act #2 — beneficiary) from the assignment's
    // visit_template. Snapshotting it onto the visit row keeps the row
    // self-contained for aggregator submission and audit.
    const assignment = await scheduleRepo.getAssignmentForCaregiver(
      parsed.data.assignmentId,
      req.auth.caregiverId,
      req.auth.agencyId
    );
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    const authorizedServiceCode = assignment.serviceCode
      ? evvServiceCodeSchema.safeParse(assignment.serviceCode)
      : null;
    if (assignment.serviceCode && !authorizedServiceCode?.success) {
      return res.status(400).json({ message: 'Assignment authorization service code is not supported for PA EVV' });
    }
    if (
      authorizedServiceCode?.success &&
      parsed.data.serviceCode &&
      authorizedServiceCode.data !== parsed.data.serviceCode
    ) {
      return res.status(400).json({ message: 'serviceCode does not match the client authorization' });
    }
    const serviceCode = authorizedServiceCode?.success ? authorizedServiceCode.data : parsed.data.serviceCode;
    if (!serviceCode) {
      // Cures-Act #1 — service code is mandatory at clock-in. Refuse rather
      // than silently NULLing it; downstream aggregator submission will reject
      // a visit row without a service code anyway.
      return res.status(400).json({ message: 'serviceCode (HCPCS) is required at clock-in' });
    }

    const visit = await repo.createVisit({
      assignmentId: parsed.data.assignmentId,
      caregiverId: req.auth.caregiverId,
      clientId: assignment.clientId,
      serviceCode,
      clockInTime: new Date().toISOString(),
      clockInLocation: parsed.data.location,
      status: 'pending'
    });
    res.status(201).json(visit);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/clock-out/:id', requireCapability('evv.write'), async (req, res) => {
  try {
    if (!req.auth.caregiverId) return res.status(403).json({ message: 'User is not authorized as a caregiver' });
    const rawId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const id = evvVisitIdSchema.safeParse(rawId);
    const parsed = evvClockOutInputSchema.safeParse(req.body ?? {});
    if (!id.success || !parsed.success) {
      return res.status(400).json({ message: 'Valid visit id and GPS location are required' });
    }

    const db = req.app.get('db');
    const repo = new EvvRepository(db);
    const existing = await repo.getVisitByIdForAgency(id.data, req.auth.agencyId);
    if (!existing || existing.caregiverId !== req.auth.caregiverId) {
      return res.status(404).json({ message: 'Visit not found' });
    }

    // updateVisit returns null when the visit is on another tenant OR does
    // not exist. Both surface as 404 — we never confirm cross-tenant existence.
    const visit = await repo.updateVisit(id.data, req.auth.agencyId, {
      clockOutTime: new Date().toISOString(),
      clockOutLocation: parsed.data.location,
      status: 'verified'
    });
    if (!visit) return res.status(404).json({ message: 'Visit not found' });
    res.json(visit);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
