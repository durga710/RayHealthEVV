import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { VisitMaintenanceRepository } from '@rayhealth/core';
const router = Router();
router.post('/request-unlock', requireCapability('schedule.write'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new VisitMaintenanceRepository(db);
        const maintenance = await repo.requestUnlock({
            visitId: req.body.visitId,
            requesterId: req.auth.userId || 'system',
            reason: req.body.reason,
            status: 'pending'
        });
        res.status(201).json(maintenance);
    }
    catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.post('/approve-unlock/:id', requireCapability('schedule.write'), async (req, res) => {
    try {
        const id = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
        const db = req.app.get('db');
        const repo = new VisitMaintenanceRepository(db);
        const maintenance = await repo.approveUnlock(id, req.body.adjustedTimes);
        if (!maintenance)
            return res.status(404).json({ message: 'Unlock request not found' });
        res.json(maintenance);
    }
    catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
export default router;
//# sourceMappingURL=maintenance-routes.js.map