import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import {
  EvvRepository,
  ScheduleRepository,
  evvClockInInputSchema,
  evvClockOutInputSchema,
  evvVisitIdSchema
} from '@rayhealth/core';

const router = Router();

router.get('/visits', requireCapability('evv.read'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new EvvRepository(db);
    // In a real implementation, you'd filter by agencyId from req.auth.agencyId
    const visits = await repo.getAllVisits(); 
    res.json(visits);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/clock-in', requireCapability('evv.write'), async (req, res) => {
  try {
    if (!req.auth.caregiverId) return res.status(403).json({ message: 'User is not authorized as a caregiver' });

    const parsed = evvClockInInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'A valid assignmentId and GPS location are required for EVV clock-in' });
    }

    const db = req.app.get('db');
    const scheduleRepo = new ScheduleRepository(db);
    const assignment = await scheduleRepo.getAssignmentForCaregiver(parsed.data.assignmentId, req.auth.caregiverId);
    if (!assignment) return res.status(404).json({ message: 'Assigned visit not found for this caregiver' });

    const repo = new EvvRepository(db);
    const visit = await repo.createVisit({
      assignmentId: parsed.data.assignmentId,
      caregiverId: req.auth.caregiverId,
      clockInTime: new Date().toISOString(),
      clockInLocation: parsed.data.location,
      status: 'pending'
    });
    res.status(201).json(visit);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/clock-out/:id', requireCapability('evv.write'), async (req, res) => {
  try {
    if (!req.auth.caregiverId) return res.status(403).json({ message: 'User is not authorized as a caregiver' });

    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const parsedId = evvVisitIdSchema.safeParse(id);
    if (!parsedId.success) return res.status(400).json({ message: 'A valid visit id is required for EVV clock-out' });

    const parsed = evvClockOutInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'A valid GPS location is required for EVV clock-out' });
    }

    const db = req.app.get('db');
    const repo = new EvvRepository(db);
    const existingVisit = await repo.getVisitById(parsedId.data);
    if (!existingVisit || existingVisit.caregiverId !== req.auth.caregiverId) {
      return res.status(404).json({ message: 'Visit not found' });
    }

    const visit = await repo.updateVisit(id, {
      clockOutTime: new Date().toISOString(),
      clockOutLocation: parsed.data.location,
      status: 'verified'
    });
    if (!visit) return res.status(404).json({ message: 'Visit not found' });
    res.json(visit);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * GET /api/evv/today-schedule
 *
 * Returns the authenticated caregiver's assignments for today, annotated
 * with clockedInToday so the mobile dashboard can show status.
 *
 * Response shape: TodayScheduleItem[]
 * - id: assignment UUID
 * - clientName: full name from clients table
 * - scheduledTime: null (until scheduled_date column migration lands)
 * - clockedInToday: true if caregiver already clocked-in on this assignment today
 */
router.get('/today-schedule', requireCapability('evv.read'), async (req, res) => {
  try {
    if (!req.auth.caregiverId) {
      return res.status(403).json({ message: 'Not authorized as caregiver' });
    }
    const db = req.app.get('db');
    const repo = new ScheduleRepository(db);
    // Use UTC date (YYYY-MM-DD) to match database timestamp comparisons
    const date = new Date().toISOString().slice(0, 10);
    const schedule = await repo.getTodaySchedule(req.auth.caregiverId, date);
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
