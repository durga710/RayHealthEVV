import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';
import { z } from 'zod';
const router = Router();
const CHANGEABLE_ROLES = ['admin', 'coordinator'];
const patchSchema = z.object({ role: z.enum(CHANGEABLE_ROLES) });
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
                .select('id', 'email', 'status')
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
        const staff = [
            ...caregiverRows.map((r) => ({
                id: r.id,
                email: r.email,
                role: 'caregiver',
                status: r.status,
            })),
            ...userRows.map((r) => ({
                id: r.id,
                email: r.email,
                role: r.role,
                status: 'active',
            })),
            ...inviteRows.map((r) => ({
                id: r.id,
                email: r.email,
                role: r.role,
                status: 'pending',
            })),
        ];
        res.json(staff);
    }
    catch (error) {
        safeError('GET /staff failed', error);
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
        const updated = await db('users')
            .where({ id, agency_id: req.auth.agencyId })
            .whereIn('role', CHANGEABLE_ROLES)
            .update({ role: parse.data.role, updated_at: db.fn.now() });
        if (!updated) {
            res.status(404).json({ message: 'staff member not found' });
            return;
        }
        res.json({ id, role: parse.data.role });
    }
    catch (error) {
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
            const updated = await db('caregivers')
                .where({ id, agency_id: req.auth.agencyId, status: 'active' })
                .update({ status: 'inactive', updated_at: db.fn.now() });
            if (!updated) {
                res.status(404).json({ message: 'caregiver not found' });
                return;
            }
        }
        else {
            // Only allow removing other coordinators/admins — not caregivers through this path
            const deleted = await db('users')
                .where({ id, agency_id: req.auth.agencyId })
                .whereIn('role', CHANGEABLE_ROLES)
                .delete();
            if (!deleted) {
                res.status(404).json({ message: 'staff member not found' });
                return;
            }
        }
        res.status(204).end();
    }
    catch (error) {
        safeError('DELETE /staff/:id failed', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
export default router;
//# sourceMappingURL=staff-routes.js.map