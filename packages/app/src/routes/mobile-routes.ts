import { Router } from 'express';
import { ScheduleRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';

const router = Router();

/**
 * Mobile-dashboard composite endpoint. Returns the caregiver's schedule
 * for today (12 hours back, 24 hours forward) along with everything the
 * mobile app needs to render the home screen and short-circuit a stale
 * "you're already clocked in" state without a second round-trip.
 *
 * Caregiver-only by design: this endpoint exists to satisfy the field-app
 * use case. Coordinators / admins use the existing /assignments endpoint.
 * A 403 here is a deliberate scope guard, not a permissions bug.
 *
 * `serverTime` is included so the client can detect device clock skew , 
 * the geofence + scheduled-time UI both depend on agreement with the
 * server's wall clock.
 */
router.get('/caregiver/today', requireCapability('evv.read'), async (req, res) => {
  if (!req.auth.caregiverId) {
    return res.status(403).json({ message: 'User is not authorized as a caregiver' });
  }
  try {
    const db = req.app.get('db');
    const repo = new ScheduleRepository(db);
    const schedule = await repo.getTodaysScheduleForCaregiver(
      req.auth.caregiverId,
      req.auth.agencyId
    );
    res.json({ schedule, serverTime: new Date().toISOString() });
  } catch (err) {
    safeError('Failed to load caregiver schedule', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * Forward-looking schedule for the mobile "Schedule" tab, the caregiver's
 * assignments from the start of today through `?days` days ahead (default 7,
 * clamped 1..30). Same row shape as /caregiver/today so the client can reuse
 * its schedule-row model; `serverTime` included for the same clock-skew reason.
 *
 * Caregiver-only by the same scope rationale as /caregiver/today.
 */
router.get('/caregiver/schedule', requireCapability('evv.read'), async (req, res) => {
  if (!req.auth.caregiverId) {
    return res.status(403).json({ message: 'User is not authorized as a caregiver' });
  }
  try {
    const parsed = Number.parseInt(String(req.query.days ?? '7'), 10);
    const days = Number.isFinite(parsed) ? Math.min(30, Math.max(1, parsed)) : 7;
    const db = req.app.get('db');
    const repo = new ScheduleRepository(db);
    const schedule = await repo.getUpcomingScheduleForCaregiver(
      req.auth.caregiverId,
      req.auth.agencyId,
      days
    );
    res.json({ schedule, serverTime: new Date().toISOString() });
  } catch (err) {
    safeError('Failed to load caregiver upcoming schedule', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
