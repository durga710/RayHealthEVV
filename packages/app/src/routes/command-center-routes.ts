import { Router } from 'express';
import type { Knex } from 'knex';
import { requireCapability } from '../middleware/require-capability.js';
import {
  ComplianceEngineRepository,
  LearningRepository,
  RecurringScheduleRepository,
  buildCommandCenterAttention,
  buildBriefingPrompt,
  deriveTodayVisitStatus,
} from '@rayhealth/core';
import { askAI, isAIConfigured } from '../ai.js';
import { safeError } from '../security/safe-log.js';

const router = Router();

/**
 * Compose the full command-center snapshot (counts only, no PHI) for an agency.
 * Shared by /summary and /briefing so the AI briefing always describes exactly
 * the numbers the dashboard shows.
 */
async function composeCommandCenter(db: Knex, agencyId: string) {
  const generatedAt = new Date().toISOString();
  const asOf = generatedAt.slice(0, 10);
  // 14-day forward horizon for the coverage forecast (matches the recurring
  // page's default "Generate next 14 days" window).
  const coverageEnd = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

  const engine = new ComplianceEngineRepository(db);
  const learning = new LearningRepository(db);
  const recurring = new RecurringScheduleRepository(db);

  const [today, exceptions, authorizations, credentials, claims, payroll, rollup, forecast] =
    await Promise.all([
      engine.getTodaysVisitOps(agencyId, generatedAt),
      engine.getExceptionResolution(agencyId),
      engine.getAuthorizationOversight(agencyId, asOf),
      engine.getCredentialsCompliance(agencyId, asOf),
      engine.getClaimMatching(agencyId),
      engine.getPayrollReconciliation(agencyId),
      learning.getAgencyRollup(agencyId),
      recurring.forecastCoverage(agencyId, asOf, coverageEnd),
    ]);

  const training = {
    complianceRate: rollup.complianceRate,
    overdue: rollup.overdue,
    expired: rollup.expired,
  };
  const coverage = { totalGaps: forecast.totalGaps };

  return {
    asOf,
    generatedAt,
    snapshot: { today, exceptions, authorizations, credentials, claims, payroll, training, coverage },
  };
}

/**
 * GET /command-center/summary, the agency owner's daily operating picture in a
 * single round-trip. Composes the existing agency-scoped aggregations (today's
 * visit ops, EVV exceptions, authorization oversight, credential compliance,
 * claim readiness, payroll reconciliation, training rollup, coverage forecast)
 * and runs the deterministic attention engine over them.
 *
 * agency.read = admin + coordinator only (caregivers/family are excluded). The
 * response is counts + a prioritized attention list. NO PHI rows are returned.
 */
router.get('/summary', requireCapability('agency.read'), async (req, res) => {
  try {
    if (!req.auth.agencyId) {
      return res.status(403).json({ message: 'Agency context required' });
    }
    const db = req.app.get('db');
    const { asOf, generatedAt, snapshot } = await composeCommandCenter(db, req.auth.agencyId);
    const attention = buildCommandCenterAttention(snapshot);

    res.json({ asOf, generatedAt, ...snapshot, attention });
  } catch (error) {
    safeError('Command center summary failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * POST /command-center/briefing, an AI-written, plain-English prioritization of
 * the same snapshot. Gated on a configured AI provider (platform level); when no
 * provider is set up it returns { available: false } so the UI degrades quietly.
 * The prompt is COUNT-ONLY (no PHI), built by the pure buildBriefingPrompt.
 */
router.post('/briefing', requireCapability('agency.read'), async (req, res) => {
  try {
    if (!req.auth.agencyId) {
      return res.status(403).json({ message: 'Agency context required' });
    }
    if (!isAIConfigured()) {
      return res.json({ available: false, reason: 'AI is not configured for this platform.' });
    }

    const db = req.app.get('db');
    const { generatedAt, snapshot } = await composeCommandCenter(db, req.auth.agencyId);
    const { system, prompt } = buildBriefingPrompt(snapshot);

    const result = await askAI({
      systemInstruction: system,
      prompt,
      maxOutputTokens: 350,
    });

    res.json({
      available: true,
      generatedAt,
      briefing: result.text,
      model: result.model,
      provider: result.provider,
    });
  } catch (error) {
    safeError('Command center briefing failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * GET /command-center/today, the actionable drill-down behind the "late to
 * start" attention item. Returns one row per visit scheduled today (client +
 * caregiver name, scheduled/clock times) with a derived status, plus the same
 * bucket counts the summary shows. Sorted so late + in-progress rows surface
 * first, then by scheduled time.
 *
 * agency.read = admin + coordinator only. Identity here (client/caregiver names)
 * is operational roster data the assigned office staff already manage, no
 * clinical/PHI fields are included.
 */
router.get('/today', requireCapability('agency.read'), async (req, res) => {
  try {
    if (!req.auth.agencyId) {
      return res.status(403).json({ message: 'Agency context required' });
    }
    const agencyId = req.auth.agencyId;
    const generatedAt = new Date().toISOString();
    const nowMs = new Date(generatedAt).getTime();

    const db = req.app.get('db');
    const engine = new ComplianceEngineRepository(db);
    const rows = await engine.getTodaysVisitBoard(agencyId);

    const visits = rows.map((r) => ({
      ...r,
      status: deriveTodayVisitStatus(r, nowMs),
    }));

    // Action-first ordering: late → in-progress → upcoming → completed, then by time.
    const STATUS_RANK: Record<string, number> = {
      late: 0,
      in_progress: 1,
      upcoming: 2,
      completed: 3,
    };
    visits.sort((a, b) => {
      const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (r !== 0) return r;
      return (a.scheduledStartTime ?? '').localeCompare(b.scheduledStartTime ?? '');
    });

    const counts = {
      scheduledToday: visits.length,
      late: visits.filter((v) => v.status === 'late').length,
      inProgress: visits.filter((v) => v.status === 'in_progress').length,
      upcoming: visits.filter((v) => v.status === 'upcoming').length,
      completed: visits.filter((v) => v.status === 'completed').length,
    };

    res.json({ generatedAt, counts, visits });
  } catch (error) {
    safeError('Command center today board failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
