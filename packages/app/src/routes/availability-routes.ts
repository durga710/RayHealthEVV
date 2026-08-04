/**
 * Caregiver availability and time off.
 *
 * Availability is the weekly pattern a caregiver says they can normally work.
 * Time off is specific dates they have asked not to work, plus the agency's
 * answer. Scheduling treats them differently: approved leave blocks a booking,
 * declared availability only warns. See assignment-checks.ts for why.
 *
 * Access: a caregiver manages their own availability and their own requests.
 * Only staff with `staff.write` may approve or deny. `reason` and
 * `review_note` may name a medical or family situation, so they stay inside
 * agency-scoped responses and never reach an audit payload or notification.
 */
import { Router, type Request, type Response } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { AvailabilityRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';
import { notifyCaregivers } from '../services/notification-service.js';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const availabilitySchema = z.object({
  slots: z
    .array(
      z
        .object({
          dayOfWeek: z.number().int().min(0).max(6),
          startTime: z.string().regex(TIME_RE, 'startTime must be HH:MM'),
          endTime: z.string().regex(TIME_RE, 'endTime must be HH:MM'),
        })
        .refine((s) => s.endTime > s.startTime, {
          message: 'endTime must be after startTime',
          path: ['endTime'],
        }),
    )
    // A generous ceiling: a caregiver splitting every day into a few windows
    // still lands well under it, and it stops a runaway client writing
    // thousands of rows.
    .max(50),
});

const timeOffSchema = z
  .object({
    startDate: z.string().regex(DATE_RE, 'startDate must be YYYY-MM-DD'),
    endDate: z.string().regex(DATE_RE, 'endDate must be YYYY-MM-DD'),
    reason: z.string().max(500).optional(),
  })
  .refine((r) => r.endDate >= r.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });

const reviewSchema = z.object({
  status: z.enum(['approved', 'denied']),
  note: z.string().max(500).optional(),
});

// ── Availability ────────────────────────────────────────────────────────────

// GET /availability, the calling caregiver's weekly pattern
router.get('/', requireCapability('evv.read'), async (req: Request, res: Response) => {
  if (!req.auth.caregiverId) {
    return res.status(403).json({ message: 'Only caregivers have an availability pattern' });
  }
  try {
    const db = req.app.get('db') as Knex;
    const slots = await new AvailabilityRepository(db).listAvailability(
      req.auth.caregiverId,
      req.auth.agencyId,
    );
    res.json({ slots });
  } catch (error) {
    safeError('availability list failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PUT /availability, replace the whole weekly pattern
router.put('/', requireCapability('evv.write'), async (req: Request, res: Response) => {
  if (!req.auth.caregiverId) {
    return res.status(403).json({ message: 'Only caregivers have an availability pattern' });
  }
  const parsed = availabilitySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Invalid availability',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  try {
    const db = req.app.get('db') as Knex;
    // Whole-pattern replace: the UI is a weekly grid, and a half-applied
    // update would be worse than either the old or the new week.
    const slots = await new AvailabilityRepository(db).replaceAvailability(
      req.auth.caregiverId,
      req.auth.agencyId,
      parsed.data.slots,
    );
    res.json({ slots });
  } catch (error) {
    safeError('availability save failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ── Time off ────────────────────────────────────────────────────────────────

// GET /availability/time-off, own requests (caregiver) or the queue (staff)
router.get('/time-off', requireCapability('evv.read'), async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  if (status && !['requested', 'approved', 'denied', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'invalid status filter' });
  }
  try {
    const db = req.app.get('db') as Knex;
    const repo = new AvailabilityRepository(db);
    const requests =
      req.auth.role === 'caregiver' && req.auth.caregiverId
        ? await repo.listTimeOffForCaregiver(req.auth.caregiverId, req.auth.agencyId)
        : await repo.listTimeOffForAgency(req.auth.agencyId, {
            status: status as 'requested' | undefined,
          });
    res.json({ requests });
  } catch (error) {
    safeError('time off list failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST /availability/time-off, request days off
router.post('/time-off', requireCapability('evv.write'), async (req: Request, res: Response) => {
  if (!req.auth.caregiverId) {
    return res.status(403).json({ message: 'Only caregivers can request time off' });
  }
  const parsed = timeOffSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Invalid time off request',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  try {
    const db = req.app.get('db') as Knex;
    const created = await new AvailabilityRepository(db).createTimeOff({
      agencyId: req.auth.agencyId,
      caregiverId: req.auth.caregiverId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      reason: parsed.data.reason ?? null,
    });
    res.status(201).json(created);
  } catch (error) {
    safeError('time off create failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PATCH /availability/time-off/:id/review, approve or deny
router.patch(
  '/time-off/:id/review',
  requireCapability('staff.write'),
  async (req: Request, res: Response) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return res.status(400).json({ message: 'valid time off request id required' });
    }
    const parsed = reviewSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: 'status must be approved or denied' });
    }
    try {
      const db = req.app.get('db') as Knex;
      const updated = await new AvailabilityRepository(db).reviewTimeOff(
        id,
        req.auth.agencyId,
        parsed.data.status,
        req.auth.userId,
        parsed.data.note ?? null,
      );
      // Either not in this agency or already answered. One 404 for both keeps
      // the row unprobeable and stops a second reviewer overturning the first.
      if (!updated) {
        return res.status(404).json({ message: 'No pending time off request with that id' });
      }

      // Worth interrupting for: a caregiver who does not hear the answer
      // either shows up on a day they thought was off, or misses a shift they
      // assumed was covered. Contentless, as always: no dates, no reason.
      void notifyCaregivers(db, {
        agencyId: req.auth.agencyId,
        caregiverIds: [updated.caregiverId],
        category: 'scheduleChanges',
        title: 'Time off updated',
        body: 'Your agency answered a time off request. Open RayHealth to see the details.',
        data: { kind: 'timeOff.reviewed', requestId: updated.id },
      });

      res.json(updated);
    } catch (error) {
      safeError('time off review failed', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },
);

// DELETE /availability/time-off/:id, caregiver withdraws their own request
router.delete('/time-off/:id', requireCapability('evv.write'), async (req: Request, res: Response) => {
  if (!req.auth.caregiverId) {
    return res.status(403).json({ message: 'Only caregivers can withdraw time off' });
  }
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ message: 'valid time off request id required' });
  }
  try {
    const db = req.app.get('db') as Knex;
    // Cancellable from requested OR approved: plans change, and giving a day
    // back should not need an awkward phone call. Marked cancelled rather than
    // deleted so the agency can see what happened.
    const cancelled = await new AvailabilityRepository(db).cancelOwnTimeOff(
      id,
      req.auth.caregiverId,
      req.auth.agencyId,
    );
    if (!cancelled) {
      return res.status(404).json({ message: 'No cancellable time off request with that id' });
    }
    res.status(204).end();
  } catch (error) {
    safeError('time off cancel failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
