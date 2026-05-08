import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
const router = Router();
router.get('/current', requireCapability('agency.read'), (req, res) => {
    res.json({ id: req.auth.agencyId, name: 'Keystone Care', state: 'PA' });
});
export default router;
//# sourceMappingURL=agency-routes.js.map