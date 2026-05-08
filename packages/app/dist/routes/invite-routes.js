import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
const router = Router();
router.post('/', requireCapability('staff.write'), async (req, res) => {
    const { email, role } = req.body;
    // In a real app, this would use an invite service and persist to DB
    const invite = {
        id: crypto.randomUUID(),
        agencyId: req.auth.agencyId,
        email,
        role,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    res.status(201).json(invite);
});
export default router;
//# sourceMappingURL=invite-routes.js.map