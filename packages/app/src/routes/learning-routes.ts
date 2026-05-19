import { Router, type Request, type Response } from 'express';
import type { Knex } from 'knex';
import { LearningRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';

const router = Router();

// GET /learning/courses — catalog visible to all authenticated roles (admin, coordinator, caregiver)
router.get('/courses', requireCapability('learning.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new LearningRepository(db);
    const courses = await repo.listCourses(req.auth.agencyId);
    res.json({ success: true, data: courses });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /learning/progress — caregiver's own enrollment progress
router.get('/progress', requireCapability('evv.write'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new LearningRepository(db);
    const caregiverId = req.auth.caregiverId ?? req.auth.userId;
    const progress = await repo.getCaregiverProgress(caregiverId);
    res.json({ success: true, data: progress });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /learning/rollup — agency-level compliance dashboard
router.get('/rollup', requireCapability('staff.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new LearningRepository(db);
    const rollup = await repo.getAgencyRollup(req.auth.agencyId);
    res.json({ success: true, data: rollup });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /learning/insights — actionable compliance insights for coordinators
router.get('/insights', requireCapability('staff.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new LearningRepository(db);
    const insights = await repo.getActionableInsights(req.auth.agencyId);
    res.json({ success: true, data: insights });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /learning/analytics — per-course analytics for admin view
router.get('/analytics', requireCapability('staff.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new LearningRepository(db);
    const analytics = await repo.getCourseAnalytics(req.auth.agencyId);
    res.json({ success: true, data: analytics });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /learning/enroll — coordinator enrolls a caregiver in a course
router.post('/enroll', requireCapability('staff.write'), async (req: Request, res: Response) => {
  try {
    const { caregiverId, courseId, dueAt } = req.body as {
      caregiverId?: string;
      courseId?: string;
      dueAt?: string;
    };
    if (!caregiverId || !courseId) {
      return res.status(400).json({ success: false, error: 'caregiverId and courseId are required' });
    }
    const db = req.app.get('db') as Knex;
    const repo = new LearningRepository(db);
    const enrollment = await repo.enroll({
      agencyId: req.auth.agencyId,
      caregiverId,
      courseId,
      dueAt: dueAt ?? null,
    });
    res.status(201).json({ success: true, data: enrollment });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /learning/start — mark enrollment as in_progress when caregiver opens external course
router.post('/start', requireCapability('evv.write'), async (req: Request, res: Response) => {
  try {
    const { enrollmentId } = req.body as { enrollmentId?: string };
    if (!enrollmentId) {
      return res.status(400).json({ success: false, error: 'enrollmentId is required' });
    }
    const db = req.app.get('db') as Knex;
    const repo = new LearningRepository(db);
    await repo.markInProgress(enrollmentId);
    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /learning/complete — record a course completion
router.post('/complete', requireCapability('evv.write'), async (req: Request, res: Response) => {
  try {
    const { enrollmentId, courseId, score, notes } = req.body as {
      enrollmentId?: string;
      courseId?: string;
      score?: number;
      notes?: string;
    };
    if (!enrollmentId || !courseId) {
      return res.status(400).json({ success: false, error: 'enrollmentId and courseId are required' });
    }
    const db = req.app.get('db') as Knex;
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
