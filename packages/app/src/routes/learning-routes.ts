import { Router, type Request, type Response } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';
import { LearningRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';

const router = Router();

// ── Course authoring validation ──────────────────────────────────────────────
const quizQuestionSchema = z
  .object({
    question: z.string().min(1).max(1000),
    options: z.array(z.string().min(1).max(500)).min(2).max(8),
    correct: z.number().int().min(0),
  })
  .refine((q) => q.correct < q.options.length, {
    message: 'correct answer index must point to a provided option',
    path: ['correct'],
  });

const courseModuleSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
  imageUrl: z.string().url().max(500).nullable().optional(),
  imageAlt: z.string().max(300).nullable().optional(),
});

const courseBodySchema = z.object({
  code: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).default(''),
  cadence: z.enum(['one_time', 'semi_annual', 'annual', 'biennial', 'certification']),
  expiresAfterDays: z.number().int().positive().max(3650).nullable().default(null),
  required: z.boolean().default(true),
  durationMinutes: z.number().int().min(0).max(100000).default(0),
  externalUrl: z.string().url().max(500).nullable().optional(),
  // In-app content, flat: `modules` is the ordered lesson array; objectives,
  // note, video, and quiz are siblings (they persist together server-side).
  modules: z.array(courseModuleSchema).max(40).default([]),
  objectives: z.array(z.string().max(500)).max(20).default([]),
  note: z.string().max(2000).nullable().optional(),
  videoSearchQuery: z.string().max(300).nullable().optional(),
  videoUrl: z.string().url().max(500).nullable().optional(),
  quiz: z.array(quizQuestionSchema).max(50).nullable().optional(),
});

// GET /learning/courses, catalog visible to all authenticated roles (admin, coordinator, caregiver)
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

// POST /learning/courses, author a new agency course (with in-app content + quiz)
router.post('/courses', requireCapability('staff.write'), async (req: Request, res: Response) => {
  const parsed = courseBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid course' });
  }
  try {
    const db = req.app.get('db') as Knex;
    const repo = new LearningRepository(db);
    const course = await repo.createCourse({ agencyId: req.auth.agencyId, ...parsed.data });
    res.status(201).json({ success: true, data: course });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    // Unique (agency_id, code) collision → 409
    if (/unique|duplicate|23505/.test(message)) {
      return res.status(409).json({ success: false, error: 'A course with that code already exists' });
    }
    res.status(500).json({ success: false, error: message });
  }
});

// PATCH /learning/courses/:id, edit an agency-owned course (global courses are read-only)
router.patch('/courses/:id', requireCapability('staff.write'), async (req: Request, res: Response) => {
  const parsed = courseBodySchema.partial().safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid course' });
  }
  try {
    const db = req.app.get('db') as Knex;
    const repo = new LearningRepository(db);
    const course = await repo.updateCourse(String(req.params.id), req.auth.agencyId, parsed.data);
    if (!course) {
      return res.status(404).json({ success: false, error: 'Course not found or not editable by your agency' });
    }
    res.json({ success: true, data: course });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    if (/unique|duplicate|23505/.test(message)) {
      return res.status(409).json({ success: false, error: 'A course with that code already exists' });
    }
    res.status(500).json({ success: false, error: message });
  }
});

// DELETE /learning/courses/:id, remove an agency-owned course
router.delete('/courses/:id', requireCapability('staff.write'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new LearningRepository(db);
    const deleted = await repo.deleteCourse(String(req.params.id), req.auth.agencyId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Course not found or not deletable by your agency' });
    }
    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

// GET /learning/progress, caregiver's own enrollment progress
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

// GET /learning/rollup, agency-level compliance dashboard
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

// GET /learning/insights, actionable compliance insights for coordinators
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

// GET /learning/analytics, per-course analytics for admin view
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

// GET /learning/courses/:id/caregivers, enrollment roster for one course (admin/coordinator)
router.get(
  '/courses/:id/caregivers',
  requireCapability('staff.read'),
  async (req: Request, res: Response) => {
    try {
      const db = req.app.get('db') as Knex;
      const repo = new LearningRepository(db);
      const envelope = await repo.getCourseCaregivers(String(req.params.id), req.auth.agencyId);
      if (!envelope) {
        return res.status(404).json({ success: false, error: 'course not found' });
      }
      res.json({ success: true, data: envelope });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unexpected error';
      res.status(500).json({ success: false, error: message });
    }
  },
);

// GET /learning/caregivers/:id, one caregiver's training progress (admin/coordinator).
// Agency-scoped: the caregiver must belong to the caller's agency.
router.get(
  '/caregivers/:id',
  requireCapability('staff.read'),
  async (req: Request, res: Response) => {
    try {
      const db = req.app.get('db') as Knex;
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unexpected error';
      res.status(500).json({ success: false, error: message });
    }
  },
);

// POST /learning/enroll, coordinator enrolls a caregiver in a course
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
    // Caregiver not owned by this agency → 404, without leaking cross-tenant existence.
    if (/not found/i.test(message)) {
      return res.status(404).json({ success: false, error: 'Caregiver not found' });
    }
    res.status(500).json({ success: false, error: message });
  }
});

// POST /learning/start, mark enrollment as in_progress when caregiver opens external course
router.post('/start', requireCapability('evv.write'), async (req: Request, res: Response) => {
  try {
    const { enrollmentId } = req.body as { enrollmentId?: string };
    if (!enrollmentId) {
      return res.status(400).json({ success: false, error: 'enrollmentId is required' });
    }
    const db = req.app.get('db') as Knex;
    const repo = new LearningRepository(db);
    const updated = await repo.markInProgress(enrollmentId, req.auth.agencyId);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Enrollment not found' });
    }
    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

// ── Resume state ─────────────────────────────────────────────────────────────
//
// Position only: which step the caregiver is on and which option they picked
// per quiz question. No PHI, no free text, so this is safe to write on every
// step change. The bounds below are generous sanity limits, not content
// validation; the player clamps the index against the live course anyway.
const resumeStateSchema = z.object({
  enrollmentId: z.string().uuid(),
  stepIndex: z.number().int().min(0).max(1000),
  answers: z.array(z.number().int().min(0).max(50).nullable()).max(200),
});

// POST /learning/resume, save where the caregiver is inside the course player
router.post('/resume', requireCapability('evv.write'), async (req: Request, res: Response) => {
  const parsed = resumeStateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'enrollmentId, stepIndex and answers are required',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  try {
    const db = req.app.get('db') as Knex;
    const repo = new LearningRepository(db);
    const caregiverId = req.auth.caregiverId ?? req.auth.userId;
    const saved = await repo.saveResumeState(parsed.data.enrollmentId, req.auth.agencyId, caregiverId, {
      stepIndex: parsed.data.stepIndex,
      answers: parsed.data.answers,
    });
    // A completed or foreign enrollment simply has nothing to save. Answering
    // 404 either way keeps it from being probed for cross-tenant existence.
    if (!saved) {
      return res.status(404).json({ success: false, error: 'Enrollment not found' });
    }
    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

// POST /learning/complete, record a course completion
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
    const completion = await repo.recordCompletion(
      {
        enrollmentId,
        caregiverId,
        courseId,
        completedAt: new Date().toISOString(),
        score: score ?? null,
        notes: notes ?? null,
      },
      req.auth.agencyId,
    );
    // The resume pointer is meaningless once the course is finished, and a
    // stale one would send a returning caregiver back into the quiz. The
    // completion is the record that matters, so failing to clear the pointer
    // must never turn a saved completion into an error response.
    try {
      await repo.clearResumeState(enrollmentId, req.auth.agencyId);
    } catch {
      /* best-effort cleanup */
    }
    res.status(201).json({ success: true, data: completion });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    // A missing/foreign enrollment or course is a 404, not a server error , 
    // and doesn't disclose whether the id exists in another tenant.
    if (/not found/i.test(message)) {
      return res.status(404).json({ success: false, error: 'Enrollment or course not found' });
    }
    res.status(500).json({ success: false, error: message });
  }
});

// GET /learning/certificate/:courseId, certificate of completion for the
// authenticated caregiver's completed course (404 if not completed)
router.get('/certificate/:courseId', requireCapability('evv.write'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new LearningRepository(db);
    const caregiverId = req.auth.caregiverId ?? req.auth.userId;
    const certificate = await repo.getCertificate(String(req.params.courseId), caregiverId);
    if (!certificate) {
      return res.status(404).json({ success: false, error: 'No completed enrollment found for this course' });
    }
    res.json({ success: true, data: certificate });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
