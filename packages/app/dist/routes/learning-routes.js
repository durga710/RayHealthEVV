import { Router } from 'express';
import { LearningRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
const router = Router();
// GET /learning/courses — catalog visible to all authenticated roles (admin, coordinator, caregiver)
router.get('/courses', requireCapability('learning.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new LearningRepository(db);
        const courses = await repo.listCourses(req.auth.agencyId);
        res.json({ success: true, data: courses });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error';
        res.status(500).json({ success: false, error: message });
    }
});
// GET /learning/progress — caregiver's own enrollment progress
router.get('/progress', requireCapability('evv.write'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new LearningRepository(db);
        const caregiverId = req.auth.caregiverId ?? req.auth.userId;
        const progress = await repo.getCaregiverProgress(caregiverId);
        res.json({ success: true, data: progress });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error';
        res.status(500).json({ success: false, error: message });
    }
});
// GET /learning/rollup — agency-level compliance dashboard
router.get('/rollup', requireCapability('staff.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new LearningRepository(db);
        const rollup = await repo.getAgencyRollup(req.auth.agencyId);
        res.json({ success: true, data: rollup });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error';
        res.status(500).json({ success: false, error: message });
    }
});
// GET /learning/insights — actionable compliance insights for coordinators
router.get('/insights', requireCapability('staff.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new LearningRepository(db);
        const insights = await repo.getActionableInsights(req.auth.agencyId);
        res.json({ success: true, data: insights });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error';
        res.status(500).json({ success: false, error: message });
    }
});
// GET /learning/analytics — per-course analytics for admin view
router.get('/analytics', requireCapability('staff.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new LearningRepository(db);
        const analytics = await repo.getCourseAnalytics(req.auth.agencyId);
        res.json({ success: true, data: analytics });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error';
        res.status(500).json({ success: false, error: message });
    }
});
// GET /learning/courses/:id/caregivers — enrollment roster for one course (admin/coordinator)
router.get('/courses/:id/caregivers', requireCapability('staff.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new LearningRepository(db);
        const envelope = await repo.getCourseCaregivers(String(req.params.id), req.auth.agencyId);
        if (!envelope) {
            return res.status(404).json({ success: false, error: 'course not found' });
        }
        res.json({ success: true, data: envelope });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error';
        res.status(500).json({ success: false, error: message });
    }
});
// GET /learning/caregivers/:id — one caregiver's training progress (admin/coordinator).
// Agency-scoped: the caregiver must belong to the caller's agency.
router.get('/caregivers/:id', requireCapability('staff.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const caregiverId = String(req.params.id);
        const owned = await db('caregivers')
            .where({ id: caregiverId, agency_id: req.auth.agencyId })
            .first('id');
        if (!owned) {
            return res.status(404).json({ success: false, error: 'caregiver not found' });
        }
        const repo = new LearningRepository(db);
        const progress = await repo.getCaregiverProgress(caregiverId);
        res.json({ success: true, data: progress });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error';
        res.status(500).json({ success: false, error: message });
    }
});
// POST /learning/enroll — coordinator enrolls a caregiver in a course
router.post('/enroll', requireCapability('staff.write'), async (req, res) => {
    try {
        const { caregiverId, courseId, dueAt } = req.body;
        if (!caregiverId || !courseId) {
            return res.status(400).json({ success: false, error: 'caregiverId and courseId are required' });
        }
        const db = req.app.get('db');
        const repo = new LearningRepository(db);
        const enrollment = await repo.enroll({
            agencyId: req.auth.agencyId,
            caregiverId,
            courseId,
            dueAt: dueAt ?? null,
        });
        res.status(201).json({ success: true, data: enrollment });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error';
        res.status(500).json({ success: false, error: message });
    }
});
// POST /learning/start — mark enrollment as in_progress when caregiver opens external course
router.post('/start', requireCapability('evv.write'), async (req, res) => {
    try {
        const { enrollmentId } = req.body;
        if (!enrollmentId) {
            return res.status(400).json({ success: false, error: 'enrollmentId is required' });
        }
        const db = req.app.get('db');
        const repo = new LearningRepository(db);
        await repo.markInProgress(enrollmentId);
        res.json({ success: true });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error';
        res.status(500).json({ success: false, error: message });
    }
});
// POST /learning/complete — record a course completion
router.post('/complete', requireCapability('evv.write'), async (req, res) => {
    try {
        const { enrollmentId, courseId, score, notes } = req.body;
        if (!enrollmentId || !courseId) {
            return res.status(400).json({ success: false, error: 'enrollmentId and courseId are required' });
        }
        const db = req.app.get('db');
        const repo = new LearningRepository(db);
        const caregiverId = req.auth.caregiverId ?? req.auth.userId;
        const completion = await repo.recordCompletion({
            enrollmentId,
            caregiverId,
            courseId,
            completedAt: new Date().toISOString(),
            score: score ?? null,
            notes: notes ?? null,
        });
        res.status(201).json({ success: true, data: completion });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error';
        res.status(500).json({ success: false, error: message });
    }
});
export default router;
//# sourceMappingURL=learning-routes.js.map