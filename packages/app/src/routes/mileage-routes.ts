/**
 * Caregiver mileage.
 *
 * Caregivers log trips; agency staff approve or reject them. The split is
 * strict: a caregiver may only ever see, create, or withdraw their own
 * entries, and only staff with `staff.write` may rule on one. A caregiver
 * approving their own reimbursement would be the whole point of the workflow
 * defeated.
 *
 * `purpose` is caregiver-authored free text and is treated as potentially
 * PHI, because somebody will eventually type a client's name into it. It is
 * returned only inside agency-scoped responses and never copied into an audit
 * payload or a notification body.
 */
import { Router, type Request, type Response } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { MileageRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Miles arrive as a decimal from the UI and are stored as hundredths.
 *
 * The 500-mile ceiling is a typo guard, not a policy: a home-care caregiver
 * does not drive 500 miles between clients in a day, and catching a slipped
 * decimal here beats explaining a four-figure reimbursement later. Zero is
 * rejected because a zero-mile trip is a mistake, not a claim.
 */
const createSchema = z.object({
  tripDate: z.string().regex(DATE_RE, 'tripDate must be YYYY-MM-DD'),
  miles: z.number().positive().max(500),
  purpose: z.string().max(500).optional(),
  visitId: z.string().uuid().optional(),
});

const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().max(500).optional(),
});

const listQuerySchema = z.object({
  from: z.string().regex(DATE_RE).optional(),
  to: z.string().regex(DATE_RE).optional(),
  status: z.enum(['submitted', 'approved', 'rejected']).optional(),
});

/** Trips cannot be logged in the future; a trip either happened or it didn't. */
function isFutureDate(tripDate: string): boolean {
  return tripDate > new Date().toISOString().slice(0, 10);
}

// GET /mileage, the caller's own trips (caregiver) or the agency queue (staff)
router.get('/', requireCapability('evv.read'), async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'from/to must be YYYY-MM-DD and status must be valid' });
  }
  try {
    const db = req.app.get('db') as Knex;
    const repo = new MileageRepository(db);
    // A caregiver sees only their own trips. Anyone else with evv.read sees
    // the agency queue, which is what the review screen needs.
    const entries =
      req.auth.role === 'caregiver' && req.auth.caregiverId
        ? await repo.listForCaregiver(req.auth.caregiverId, req.auth.agencyId, parsed.data)
        : await repo.listForAgency(req.auth.agencyId, parsed.data);
    res.json({ entries });
  } catch (error) {
    safeError('mileage list failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// POST /mileage, log a trip
router.post('/', requireCapability('evv.write'), async (req: Request, res: Response) => {
  if (!req.auth.caregiverId) {
    return res.status(403).json({ message: 'Only caregivers can log mileage' });
  }
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.issues[0]?.message ?? 'Invalid mileage entry',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (isFutureDate(parsed.data.tripDate)) {
    return res.status(400).json({ message: 'tripDate cannot be in the future' });
  }

  try {
    const db = req.app.get('db') as Knex;
    const entry = await new MileageRepository(db).create({
      agencyId: req.auth.agencyId,
      caregiverId: req.auth.caregiverId,
      visitId: parsed.data.visitId ?? null,
      tripDate: parsed.data.tripDate,
      // Rounded at the boundary so the stored integer is the only
      // representation the rest of the system ever sees.
      milesHundredths: Math.round(parsed.data.miles * 100),
      purpose: parsed.data.purpose ?? null,
    });
    res.status(201).json(entry);
  } catch (error) {
    safeError('mileage create failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PATCH /mileage/:id/review, approve or reject a submitted trip
router.patch('/:id/review', requireCapability('staff.write'), async (req: Request, res: Response) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ message: 'valid mileage entry id required' });
  }
  const parsed = reviewSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: 'status must be approved or rejected' });
  }

  try {
    const db = req.app.get('db') as Knex;
    const updated = await new MileageRepository(db).review(
      id,
      req.auth.agencyId,
      parsed.data.status,
      req.auth.userId,
      parsed.data.note ?? null,
    );
    // Either the entry is not in this agency, or it has already been ruled on.
    // A single 404 for both keeps the row from being probed across tenants and
    // stops a second reviewer silently overwriting the first decision.
    if (!updated) {
      return res.status(404).json({ message: 'No submitted mileage entry with that id' });
    }
    res.json(updated);
  } catch (error) {
    safeError('mileage review failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// DELETE /mileage/:id, withdraw one's own not-yet-reviewed trip
router.delete('/:id', requireCapability('evv.write'), async (req: Request, res: Response) => {
  if (!req.auth.caregiverId) {
    return res.status(403).json({ message: 'Only caregivers can withdraw mileage' });
  }
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ message: 'valid mileage entry id required' });
  }
  try {
    const db = req.app.get('db') as Knex;
    const removed = await new MileageRepository(db).deleteOwnSubmitted(
      id,
      req.auth.caregiverId,
      req.auth.agencyId,
    );
    // Once the agency has ruled on a trip, the record of that decision is not
    // the caregiver's to erase.
    if (!removed) {
      return res.status(404).json({ message: 'No withdrawable mileage entry with that id' });
    }
    res.status(204).end();
  } catch (error) {
    safeError('mileage delete failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
