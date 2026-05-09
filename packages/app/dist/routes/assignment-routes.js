import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { ScheduleRepository, assignmentInputSchema } from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';
const router = Router();
router.get('/caregiver', requireCapability('schedule.read'), async (req, res) => {
    try {
        if (!req.auth.caregiverId) {
            return res.status(403).json({ message: 'User is not authorized as a caregiver' });
        }
        const db = req.app.get('db');
        const repo = new ScheduleRepository(db);
        const assignments = await repo.getAssignmentsByCaregiver(req.auth.caregiverId, req.auth.agencyId);
        res.json(assignments);
    }
    catch (error) {
        safeError('Failed to get caregiver assignments', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.post('/', requireCapability('schedule.write'), async (req, res) => {
    try {
        const db = req.app.get('db');
        if (!db) {
            safeError('Database connection not found in app context');
            return res.status(500).json({ message: 'Database connection missing' });
        }
        const repo = new ScheduleRepository(db);
        const parsed = assignmentInputSchema.safeParse({
            caregiverId: req.body.caregiverId,
            visitTemplateId: req.body.visitTemplateId,
            credentialStatus: 'active'
        });
        if (!parsed.success) {
            return res.status(400).json({ message: 'Valid caregiverId and visitTemplateId are required' });
        }
        const assignment = await repo.createAssignment(parsed.data);
        res.status(201).json({ ...assignment, visitDate: req.body.visitDate });
    }
    catch (error) {
        safeError('Assignment creation failed', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.get('/', requireCapability('schedule.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new ScheduleRepository(db);
        // Caregivers must only see their own assignments. Without this dispatch,
        // a caregiver with `schedule.read` can dump every assignment in the agency.
        if (req.auth.role === 'caregiver') {
            if (!req.auth.caregiverId) {
                return res.status(403).json({ message: 'User is not authorized as a caregiver' });
            }
            const own = await repo.getAssignmentsByCaregiver(req.auth.caregiverId, req.auth.agencyId);
            return res.json(own);
        }
        const assignments = await repo.getAssignments(req.auth.agencyId);
        res.json(assignments);
    }
    catch {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
export default router;
//# sourceMappingURL=assignment-routes.js.map