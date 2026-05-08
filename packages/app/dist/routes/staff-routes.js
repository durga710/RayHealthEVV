import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
const router = Router();
router.get('/', requireCapability('staff.read'), (req, res) => {
    res.json([]);
});
export default router;
//# sourceMappingURL=staff-routes.js.map