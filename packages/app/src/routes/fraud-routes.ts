import { Router } from 'express';
import { z } from 'zod';
import { EvvRepository, FraudContextBuilder, scoreVisit } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';

const router = Router();

/**
 * Native visit fraud scoring (RayVerify signals on our own EVV data). All routes
 * are agency-scoped and require `evv.read` (admins + coordinators — the review
 * roles). No PHI leaves the tenant: verdicts carry coordinates, times, and
 * plain-English explanations, never client names or Medicaid identifiers.
 */

const flaggedQuerySchema = z.object({
  // How many of the most recent completed visits to score in one sweep.
  limit: z.coerce.number().int().min(1).max(200).default(100),
  // Only return visits at or above this fused score (0 returns everything scored).
  minScore: z.coerce.number().int().min(0).max(100).default(1),
});

/**
 * GET /api/fraud/visits/:visitId
 * Score a single completed visit and return its explainable verdict.
 */
router.get('/visits/:visitId', requireCapability('evv.read'), async (req, res) => {
  try {
    if (!req.auth.agencyId) {
      return res.status(403).json({ message: 'Agency context required' });
    }
    const visitId = z.string().uuid().safeParse(req.params.visitId);
    if (!visitId.success) {
      return res.status(400).json({ message: 'A valid visit id is required' });
    }

    const db = req.app.get('db');
    const ctx = await new FraudContextBuilder(db).build(visitId.data, req.auth.agencyId);
    if (!ctx) {
      return res.status(404).json({ message: 'Visit not found' });
    }

    res.json({ verdict: scoreVisit(ctx) });
  } catch (error) {
    safeError('Fraud scoring failed:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * GET /api/fraud/flagged?limit=&minScore=
 * Score the most recent completed visits and return those at/above `minScore`,
 * highest first. Bounded by `limit` — the response echoes `scannedCount` and
 * `limit` so a caller can tell the sweep was capped rather than exhaustive.
 */
router.get('/flagged', requireCapability('evv.read'), async (req, res) => {
  try {
    if (!req.auth.agencyId) {
      return res.status(403).json({ message: 'Agency context required' });
    }
    const parsed = flaggedQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid limit/minScore' });
    }
    const { limit, minScore } = parsed.data;

    const db = req.app.get('db');
    const evv = new EvvRepository(db);
    const builder = new FraudContextBuilder(db);

    const recent = await evv.getVisitsForAgency(req.auth.agencyId, { limit });
    // Only completed visits can be scored (duration + full geo history).
    const completed = recent.filter((v) => v.clockOutTime && v.id);

    const verdicts = [];
    for (const visit of completed) {
      const ctx = await builder.build(visit.id as string, req.auth.agencyId);
      if (!ctx) continue;
      const verdict = scoreVisit(ctx);
      if (verdict.score >= minScore) verdicts.push(verdict);
    }
    verdicts.sort((a, b) => b.score - a.score);

    res.json({
      scannedCount: completed.length,
      flaggedCount: verdicts.length,
      limit,
      minScore,
      verdicts,
    });
  } catch (error) {
    safeError('Fraud sweep failed:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
