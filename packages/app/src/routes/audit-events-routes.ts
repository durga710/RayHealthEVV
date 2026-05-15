import { Router } from 'express';
import { z } from 'zod';
import { AuditEventRepository, auditEventTypes, auditOutcomes } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';

const router = Router();

/**
 * Admin-only paginated audit-events timeline. Same capability guard as
 * /admin/audit-retention (`audit.read`) — coordinators / caregivers /
 * family members never see this.
 *
 * Query params (all optional):
 *   - eventType : one of the canonical auditEventTypes
 *   - actorId   : uuid of the actor whose events to surface
 *   - outcome   : 'success' | 'failure' | 'denied'
 *   - from      : ISO-8601 timestamp (inclusive lower bound on occurred_at)
 *   - to        : ISO-8601 timestamp (inclusive upper bound on occurred_at)
 *   - limit     : 1..200 (default 50). Hard ceiling of 200 prevents an
 *                 admin session from being abused to bulk-exfil the log.
 *   - offset    : >= 0 (default 0)
 *
 * Returns `{ rows, total, limit, offset }`. `total` is the count across
 * the full filter set so the UI can render accurate pagination.
 */
const listQuerySchema = z.object({
  eventType: z.enum(auditEventTypes).optional(),
  actorId: z.string().uuid().optional(),
  outcome: z.enum(auditOutcomes).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

router.get('/', requireCapability('audit.read'), async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      message: 'Invalid query parameters',
      issues: parsed.error.issues
    });
    return;
  }

  const { eventType, actorId, outcome, from, to, limit, offset } = parsed.data;
  const effectiveLimit = limit ?? 50;
  const effectiveOffset = offset ?? 0;

  try {
    const db = req.app.get('db');
    const { rows, total } = await new AuditEventRepository(db).list({
      agencyId: req.auth.agencyId,
      eventType,
      actorId,
      outcome,
      fromIso: from,
      toIso: to,
      limit: effectiveLimit,
      offset: effectiveOffset
    });

    res.json({
      rows,
      total,
      limit: effectiveLimit,
      offset: effectiveOffset
    });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
