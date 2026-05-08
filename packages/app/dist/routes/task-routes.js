import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { paTasks } from '@rayhealth/core';
const router = Router();
router.get('/', requireCapability('schedule.read'), (req, res) => {
    res.json(paTasks);
});
export default router;
//# sourceMappingURL=task-routes.js.map