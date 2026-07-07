import { Router } from 'express';
import { z } from 'zod';
import { requireCapability } from '../middleware/require-capability.js';
import { AuditEventRepository, VisitMaintenanceRepository, type NewAuditEvent } from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';

const router = Router();

type AuditDb = ConstructorParameters<typeof AuditEventRepository>[0];

// Best-effort audit write — never blocks or fails the maintenance action, but
// the durable non-repudiation record lives on the visit_maintenance row itself
// (requester_id / approver_id / approved_at), so a dropped audit event does not
// lose attribution.
async function recordAuditEvent(db: AuditDb, event: NewAuditEvent): Promise<void> {
  try {
    await new AuditEventRepository(db).create(event);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      safeError('Failed to persist visit-maintenance audit event', error);
    }
  }
}

// Adjusted clock times for an approved correction. Both must be valid ISO
// datetimes and the end must come strictly after the start — a negative- or
// zero-duration correction is rejected at the boundary rather than written as a
// billable visit.
const adjustedTimesSchema = z
  .object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  })
  .refine((t) => new Date(t.end).getTime() > new Date(t.start).getTime(), {
    message: 'adjustedTimes.end must be after adjustedTimes.start',
    path: ['end'],
  });

router.post('/request-unlock', requireCapability('schedule.write'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new VisitMaintenanceRepository(db);
    const requesterId = req.auth.userId || 'system';
    const maintenance = await repo.requestUnlock(
      {
        visitId: req.body.visitId,
        requesterId,
        reason: req.body.reason,
        status: 'pending'
      },
      req.auth.agencyId
    );
    await recordAuditEvent(db, {
      agencyId: req.auth.agencyId,
      actorId: requesterId,
      actorType: 'user',
      eventType: 'visit.maintenance.requested',
      entityType: 'visit_maintenance',
      entityId: maintenance.id ?? maintenance.visitId,
      outcome: 'success',
      payload: { visitId: maintenance.visitId, reason: maintenance.reason },
      occurredAt: new Date().toISOString()
    });
    res.status(201).json(maintenance);
  } catch (error) {
    // requestUnlock throws when visitId doesn't belong to the caller's
    // agency — treat that the same as "visit not found", not a 500, and
    // don't leak whether the visit exists on another tenant.
    res.status(404).json({ message: 'Visit not found' });
  }
});

router.post('/approve-unlock/:id', requireCapability('schedule.write'), async (req, res) => {
  const parsed = adjustedTimesSchema.safeParse(req.body?.adjustedTimes);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid adjustedTimes' });
    return;
  }
  try {
    const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const db = req.app.get('db');
    const repo = new VisitMaintenanceRepository(db);
    const approverId = req.auth.userId || 'system';
    const maintenance = await repo.approveUnlock(id, req.auth.agencyId, approverId, parsed.data);
    if (!maintenance) return res.status(404).json({ message: 'Unlock request not found' });
    await recordAuditEvent(db, {
      agencyId: req.auth.agencyId,
      actorId: approverId,
      actorType: 'user',
      eventType: 'visit.maintenance.approved',
      entityType: 'visit_maintenance',
      entityId: maintenance.id ?? id,
      outcome: 'success',
      payload: {
        visitId: maintenance.visitId,
        requesterId: maintenance.requesterId,
        adjustedStartTime: parsed.data.start,
        adjustedEndTime: parsed.data.end
      },
      occurredAt: new Date().toISOString()
    });
    res.json(maintenance);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
