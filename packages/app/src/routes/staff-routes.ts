import { Router } from 'express';
import { CaregiverRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';
import { z } from 'zod';

const router = Router();

const CHANGEABLE_ROLES = ['admin', 'coordinator'] as const;
const patchSchema = z.object({ role: z.enum(CHANGEABLE_ROLES) });
const npiSchema = z.object({ npi: z.string().regex(/^\d{10}$/, 'NPI must be exactly 10 digits') });

/**
 * GET /staff — lists all staff for the caller's agency.
 *
 * Returns a unified view of:
 *  - active caregivers from the caregivers table (id = caregivers.id,
 *    which is the FK used by assignments — not users.id)
 *  - active coordinator / admin users from the users table
 *  - pending (non-expired) invites from staff_invites
 *
 * Test-fixture accounts (email ending in .local) are excluded.
 */
router.get('/', requireCapability('staff.read'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const agencyId = req.auth.agencyId;

    const [caregiverRows, userRows, inviteRows] = await Promise.all([
      db('caregivers')
        .where({ agency_id: agencyId, status: 'active' })
        .select('id', 'email', 'status', db.raw('(npi IS NOT NULL) as has_npi'))
        .orderBy('first_name'),

      db('users')
        .where({ agency_id: agencyId })
        .whereIn('role', ['coordinator', 'admin'])
        .whereRaw("email NOT LIKE '%.local'")
        .select('id', 'email', 'role'),

      db('staff_invites')
        .where({ agency_id: agencyId, status: 'pending' })
        .where('expires_at', '>', db.fn.now())
        .select('id', 'email', 'role'),
    ]);

    type CaregiverRow = { id: string; email: string; status: string; has_npi: boolean };
    type UserRow = { id: string; email: string; role: string };
    type InviteRow = { id: string; email: string; role: string };

    const staff = [
      ...(caregiverRows as CaregiverRow[]).map((r) => ({
        id: r.id,
        email: r.email,
        role: 'caregiver',
        status: r.status,
        hasNpi: Boolean(r.has_npi),
      })),
      ...(userRows as UserRow[]).map((r) => ({
        id: r.id,
        email: r.email,
        role: r.role,
        status: 'active',
      })),
      ...(inviteRows as InviteRow[]).map((r) => ({
        id: r.id,
        email: r.email,
        role: r.role,
        status: 'pending',
      })),
    ];

    res.json(staff);
  } catch (error) {
    safeError('GET /staff failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PATCH /staff/caregivers/:id — set a caregiver's NPI (rendering provider).
// Mounted before /:id so the literal segment wins over the param route.
router.patch('/caregivers/:id', requireCapability('staff.write'), async (req, res) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const parse = npiSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: parse.error.issues[0]?.message ?? 'Invalid NPI' });
    return;
  }
  try {
    const db = req.app.get('db');
    const ok = await new CaregiverRepository(db).updateNpi(id, req.auth.agencyId, parse.data.npi);
    if (!ok) {
      res.status(404).json({ message: 'caregiver not found' });
      return;
    }
    res.json({ id, hasNpi: true });
  } catch (error) {
    safeError('PATCH /staff/caregivers/:id failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PATCH /staff/:id — change role for a coordinator or admin user
router.patch('/:id', requireCapability('staff.write'), async (req, res) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const parse = patchSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ message: 'role must be admin or coordinator' });
    return;
  }

  try {
    const db = req.app.get('db');
    const updated: number = await db('users')
      .where({ id, agency_id: req.auth.agencyId })
      .whereIn('role', CHANGEABLE_ROLES)
      .update({ role: parse.data.role, updated_at: db.fn.now() });

    if (!updated) {
      res.status(404).json({ message: 'staff member not found' });
      return;
    }
    res.json({ id, role: parse.data.role });
  } catch (error) {
    safeError('PATCH /staff/:id failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// DELETE /staff/:id?type=user|caregiver — remove a staff member
// - type=caregiver: soft-delete (status → inactive)
// - type=user: hard-delete coordinator/admin (sessions CASCADE)
router.delete('/:id', requireCapability('staff.write'), async (req, res) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const type = req.query.type;

  if (type !== 'user' && type !== 'caregiver') {
    res.status(400).json({ message: 'type must be user or caregiver' });
    return;
  }

  // Prevent admins from removing themselves
  if (type === 'user' && id === req.auth.userId) {
    res.status(403).json({ message: 'Cannot remove yourself' });
    return;
  }

  try {
    const db = req.app.get('db');

    if (type === 'caregiver') {
      const updated: number = await db('caregivers')
        .where({ id, agency_id: req.auth.agencyId, status: 'active' })
        .update({ status: 'inactive', updated_at: db.fn.now() });
      if (!updated) {
        res.status(404).json({ message: 'caregiver not found' });
        return;
      }
    } else {
      // Only allow removing other coordinators/admins — not caregivers through this path
      const deleted: number = await db('users')
        .where({ id, agency_id: req.auth.agencyId })
        .whereIn('role', CHANGEABLE_ROLES)
        .delete();
      if (!deleted) {
        res.status(404).json({ message: 'staff member not found' });
        return;
      }
    }

    res.status(204).end();
  } catch (error) {
    safeError('DELETE /staff/:id failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
