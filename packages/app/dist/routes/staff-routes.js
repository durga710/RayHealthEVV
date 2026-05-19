import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';
const router = Router();
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
export default router;
//# sourceMappingURL=staff-routes.js.map