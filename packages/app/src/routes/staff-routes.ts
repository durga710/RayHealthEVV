import { Router } from 'express';
import {
  AuditEventRepository,
  CaregiverRepository,
  CredentialComplianceService,
  EvvRepository,
  paCredentialTypes,
  paCredentialStatuses,
} from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';
import { z } from 'zod';

const router = Router();

const CHANGEABLE_ROLES = ['admin', 'coordinator'] as const;
const patchSchema = z.object({ role: z.enum(CHANGEABLE_ROLES) });
const npiSchema = z.object({ npi: z.string().regex(/^\d{10}$/, 'NPI must be exactly 10 digits') });

// Body schema for adding a caregiver credential. caregiverId comes from the
// URL, not the body, so it is omitted here.
const credentialBodySchema = z.object({
  credentialType: z.enum(paCredentialTypes),
  status: z.enum(paCredentialStatuses).default('pending'),
  expiresAt: z.string().date(),
  issuedAt: z.string().date().optional(),
  notes: z.string().max(2000).optional(),
});

/**
 * GET /staff, lists all staff for the caller's agency.
 *
 * Returns a unified view of:
 *  - active caregivers from the caregivers table (id = caregivers.id,
 *    which is the FK used by assignments, not users.id)
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

// PATCH /staff/caregivers/:id, set a caregiver's NPI (rendering provider).
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

// ── Caregiver credentialing ───────────────────────────────────────────────
// GET    /staff/caregivers/:id/credentials           , list + compliance roll-up
// POST   /staff/caregivers/:id/credentials           , add a credential
// DELETE /staff/caregivers/:id/credentials/:credId   , expire a credential
//
// Every route validates the caregiver belongs to the caller's agency before
// touching credential rows (getCredentials/expireCredential already join
// caregivers on agency_id, but the POST path inserts by caregiver_id and so
// needs the explicit guard to prevent cross-agency writes).

// GET /staff/caregivers/:id, one caregiver's full profile (agency-scoped).
// Exposes hasNpi (boolean) rather than the decrypted NPI, mirroring the list
// endpoint's deliberate non-disclosure of the raw value.
router.get('/caregivers/:id', requireCapability('staff.read'), async (req, res) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  try {
    const db = req.app.get('db');
    const caregiver = await new CaregiverRepository(db).findById(id, req.auth.agencyId);
    if (!caregiver) {
      res.status(404).json({ message: 'caregiver not found' });
      return;
    }
    res.json({
      id: caregiver.id,
      firstName: caregiver.firstName,
      lastName: caregiver.lastName,
      email: caregiver.email,
      phone: caregiver.phone ?? null,
      hireDate: caregiver.hireDate ?? null,
      status: caregiver.status,
      hasNpi: Boolean(caregiver.npi),
    });
  } catch (error) {
    safeError('GET /staff/caregivers/:id failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// GET /staff/caregivers/:id/visits, one caregiver's visit history for the
// admin activity view. findById proves the caregiver is in the caller's agency
// (404 otherwise) before reading visits.
router.get('/caregivers/:id/visits', requireCapability('staff.read'), async (req, res) => {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  try {
    const db = req.app.get('db');
    const caregiver = await new CaregiverRepository(db).findById(id, req.auth.agencyId);
    if (!caregiver) {
      res.status(404).json({ message: 'caregiver not found' });
      return;
    }
    const visits = await new EvvRepository(db).getVisitsForCaregiverInAgency(id, req.auth.agencyId);
    res.json({ visits });
  } catch (error) {
    safeError('GET /staff/caregivers/:id/visits failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get(
  '/caregivers/:id/credentials',
  requireCapability('staff.read'),
  async (req, res) => {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    try {
      const db = req.app.get('db');
      const repo = new CaregiverRepository(db);
      const caregiver = await repo.findById(id, req.auth.agencyId);
      if (!caregiver) {
        res.status(404).json({ message: 'caregiver not found' });
        return;
      }
      const credentials = await repo.getCredentials(id, req.auth.agencyId);
      const compliance = new CredentialComplianceService().evaluate(credentials);
      res.json({ credentials, compliance });
    } catch (error) {
      safeError('GET /staff/caregivers/:id/credentials failed', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },
);

router.post(
  '/caregivers/:id/credentials',
  requireCapability('staff.write'),
  async (req, res) => {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const parse = credentialBodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ message: parse.error.issues[0]?.message ?? 'Invalid credential' });
      return;
    }
    try {
      const db = req.app.get('db');
      const repo = new CaregiverRepository(db);
      const caregiver = await repo.findById(id, req.auth.agencyId);
      if (!caregiver) {
        res.status(404).json({ message: 'caregiver not found' });
        return;
      }
      const credential = await repo.saveCredential({
        caregiverId: id,
        credentialType: parse.data.credentialType,
        status: parse.data.status,
        expiresAt: parse.data.expiresAt,
        issuedAt: parse.data.issuedAt,
        notes: parse.data.notes,
      });

      try {
        await new AuditEventRepository(db).create({
          agencyId: req.auth.agencyId,
          actorId: req.auth.userId,
          actorType: 'user',
          eventType: 'credential.created',
          entityType: 'credential',
          // saveCredential always returns a persisted row (returning('*')), so
          // id is present even though the domain schema types it optional.
          entityId: credential.id as string,
          outcome: 'success',
          payload: {
            caregiverId: id,
            credentialType: credential.credentialType,
            status: credential.status,
            expiresAt: credential.expiresAt,
          },
          occurredAt: new Date().toISOString(),
        });
      } catch (err) {
        safeError('Failed to audit credential.created', err);
      }

      res.status(201).json(credential);
    } catch (error) {
      safeError('POST /staff/caregivers/:id/credentials failed', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },
);

router.delete(
  '/caregivers/:id/credentials/:credId',
  requireCapability('staff.write'),
  async (req, res) => {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const rawCredId = req.params.credId;
    const credId = Array.isArray(rawCredId) ? rawCredId[0] : rawCredId;
    try {
      const db = req.app.get('db');
      const repo = new CaregiverRepository(db);
      const caregiver = await repo.findById(id, req.auth.agencyId);
      if (!caregiver) {
        res.status(404).json({ message: 'caregiver not found' });
        return;
      }
      // expireCredential is agency-scoped via its join; the caregiver guard
      // above gives a clean 404 for an unknown caregiver.
      await repo.expireCredential(credId, req.auth.agencyId);

      try {
        await new AuditEventRepository(db).create({
          agencyId: req.auth.agencyId,
          actorId: req.auth.userId,
          actorType: 'user',
          eventType: 'credential.expired',
          entityType: 'credential',
          entityId: credId,
          outcome: 'success',
          payload: { caregiverId: id },
          occurredAt: new Date().toISOString(),
        });
      } catch (err) {
        safeError('Failed to audit credential.expired', err);
      }

      res.json({ id: credId, status: 'expired' });
    } catch (error) {
      safeError('DELETE /staff/caregivers/:id/credentials/:credId failed', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },
);

// PATCH /staff/:id, change role for a coordinator or admin user
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

// DELETE /staff/:id?type=user|caregiver, remove a staff member
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
      // Only allow removing other coordinators/admins, not caregivers through this path
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
