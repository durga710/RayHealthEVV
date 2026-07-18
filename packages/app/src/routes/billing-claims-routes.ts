/**
 * Billing, claims + payroll routes.
 *
 * Mounted at /api/billing alongside the Stripe billing-routes (distinct
 * subpaths: /claims/*, /payroll/*). Turns GPS-verified EVV visits into Medicaid
 * claims, generates the X12 837P, scores denial risk, tracks claim status, and
 * exports payroll. Every endpoint is agency-scoped and capability-gated:
 *   - billing.read  → list / view / 837 download / payroll export
 *   - billing.write → generate / validate / change status
 *
 * Honesty: claim generation, 837 file creation, denial scoring and payroll
 * export run here in full. Actually transmitting the 837 to a payer needs a
 * clearinghouse trading-partner account (external credential), the file this
 * produces is what the agency uploads there, or what an automated connector
 * would send once configured.
 */

import { Router, type Request, type Response } from 'express';
import express from 'express';
import { z } from 'zod';
import type { Knex } from 'knex';
import {
  AgencyClearinghouseConfigRepository,
  AgencyRepository,
  AuditEventRepository,
  ClaimRepository,
  ClearinghouseRemittanceFileRepository,
  adjustmentGroupLabel,
  buildPayrollExport,
  canTransitionClaim,
  claimStatuses,
  describeCarc,
  describeRarc,
  generateClaims,
  hasCapability,
  parse835,
  paServiceCodeDescriptions,
  type AuthorizationContext,
  type BilledLineUnits,
  type Claim,
  type ClaimStatus,
  type Era835Adjustment,
  type Era835ServiceLine,
} from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { assertCronAuthorized } from '../middleware/cron-auth.js';
import {
  build837ForClaim,
  buildTransportForAgency,
  runRemittanceSweep,
} from '../services/clearinghouse-service.js';
import { safeError } from '../security/safe-log.js';

const router = Router();

// 835 ERA files are sent as a raw text body (bypasses the global JSON limit).
const eraText = express.text({ type: ['text/plain', 'text/csv', 'application/edi-x12'], limit: '10mb' });

const datePattern = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

const generateBodySchema = z.object({
  periodStart: datePattern,
  periodEnd: datePattern,
});

const statusBodySchema = z.object({
  status: z.enum(claimStatuses),
  statusReason: z.string().max(500).optional(),
  payerClaimId: z.string().max(100).optional(),
});

function startOfDayIso(d: string): string {
  return new Date(`${d}T00:00:00.000Z`).toISOString();
}
function endOfDayIso(d: string): string {
  return new Date(`${d}T23:59:59.999Z`).toISOString();
}

/**
 * Reconstruct units already billed per authorization id, by matching each
 * prior billed line to its authorization (client + service code + date window).
 * Keeps remaining-authorization checks accurate across generation runs.
 */
function priorUnitsByAuth(
  billed: BilledLineUnits[],
  authorizations: AuthorizationContext[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of billed) {
    const auth = authorizations.find(
      (a) =>
        a.clientId === line.clientId &&
        a.serviceCode === line.serviceCode &&
        a.startDate <= line.serviceDate &&
        a.endDate >= line.serviceDate,
    );
    if (auth) out[auth.id] = (out[auth.id] ?? 0) + line.units;
  }
  return out;
}

async function audit(
  db: Knex,
  req: Request,
  eventType: Parameters<AuditEventRepository['create']>[0]['eventType'],
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await new AuditEventRepository(db).create({
      agencyId: req.auth.agencyId,
      actorId: req.auth.userId,
      actorType: 'user',
      eventType,
      entityType: 'claim',
      entityId,
      outcome: 'success',
      payload,
    });
  } catch (err) {
    process.stderr.write(
      `[audit-write-failed] ${eventType} err=${err instanceof Error ? err.message : 'unknown'}\n`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /billing/claims/generate, generate draft claims for a period
// ─────────────────────────────────────────────────────────────────────────────
router.post('/claims/generate', requireCapability('billing.write'), async (req: Request, res: Response) => {
  const parsed = generateBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: 'periodStart and periodEnd (YYYY-MM-DD) are required' });
    return;
  }
  const { periodStart, periodEnd } = parsed.data;
  if (periodStart > periodEnd) {
    res.status(400).json({ message: 'periodStart must be on or before periodEnd' });
    return;
  }

  try {
    const db = req.app.get('db') as Knex;
    const repo = new ClaimRepository(db);
    const agencyId = req.auth.agencyId;

    const [allVisits, alreadyBilled, authorizations, billedUnits, ratesByServiceCode] =
      await Promise.all([
        repo.getBillableVisits(agencyId, startOfDayIso(periodStart), endOfDayIso(periodEnd)),
        repo.getActiveClaimVisitIds(agencyId),
        repo.getAgencyAuthorizations(agencyId),
        repo.getBilledLineUnits(agencyId),
        new AgencyRepository(db).getFeeSchedule(agencyId),
      ]);

    const visits = allVisits.filter((v) => !alreadyBilled.has(v.visitId));

    const result = generateClaims({
      agencyId,
      periodStart,
      periodEnd,
      visits,
      authorizations,
      priorUnitsByAuth: priorUnitsByAuth(billedUnits, authorizations),
      ratesByServiceCode,
    });

    const created = await repo.createClaims(result.claims);

    await audit(db, req, 'claim.generated', agencyId, {
      periodStart,
      periodEnd,
      claimsGenerated: created.length,
      visitsConsidered: visits.length,
      visitsAlreadyBilled: allVisits.length - visits.length,
      unbillable: result.unbillable.length,
      highRiskClaims: created.filter((c) => c.denialRisk === 'high').length,
    });

    res.status(201).json({
      generated: created.length,
      claims: created.map(toClaimResponse),
      unbillable: result.unbillable,
    });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /billing/claims, list claims (optional status filter)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/claims', requireCapability('billing.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new ClaimRepository(db);
    const statusParam = req.query.status as string | undefined;
    const status = statusParam && (claimStatuses as readonly string[]).includes(statusParam)
      ? (statusParam as ClaimStatus)
      : undefined;
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 500);
    const offset = Number(req.query.offset ?? 0) || 0;

    const { rows, total } = await repo.listClaims(req.auth.agencyId, { status, limit, offset });
    res.json({ total, claims: rows.map(toClaimResponse) });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /billing/claims/:id, claim detail with lines
// ─────────────────────────────────────────────────────────────────────────────
router.get('/claims/:id', requireCapability('billing.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const claim = await new ClaimRepository(db).getClaim(req.auth.agencyId, String(req.params.id));
    if (!claim) {
      res.status(404).json({ message: 'Claim not found' });
      return;
    }
    res.json(toClaimDetailResponse(claim));
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /billing/claims/:id/validate, gate draft → ready
// ─────────────────────────────────────────────────────────────────────────────
router.post('/claims/:id/validate', requireCapability('billing.write'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new ClaimRepository(db);
    const claim = await repo.getClaim(req.auth.agencyId, String(req.params.id));
    if (!claim) {
      res.status(404).json({ message: 'Claim not found' });
      return;
    }
    if (claim.status !== 'draft' && claim.status !== 'rejected' && claim.status !== 'denied') {
      res.status(422).json({ message: `Claim in status "${claim.status}" cannot be validated` });
      return;
    }

    const blocking = claim.lines
      .filter((l) => l.denialRisk === 'high')
      .flatMap((l) => l.denialReasons);

    if (blocking.length > 0) {
      await audit(db, req, 'claim.validated', claim.id as string, {
        outcome: 'blocked',
        blockingReasons: blocking.length,
      });
      res.status(422).json({
        message: 'Claim has high-risk lines and cannot be marked ready',
        denialRisk: claim.denialRisk,
        blockingReasons: [...new Set(blocking)],
      });
      return;
    }

    const updated = await repo.updateStatus(req.auth.agencyId, claim.id as string, { status: 'ready' });
    await audit(db, req, 'claim.validated', claim.id as string, { newStatus: 'ready', denialRisk: claim.denialRisk });
    res.json(toClaimDetailResponse(updated as Claim));
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /billing/claims/:id/status, manual status transition
// ─────────────────────────────────────────────────────────────────────────────
router.post('/claims/:id/status', requireCapability('billing.write'), async (req: Request, res: Response) => {
  const parsed = statusBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: 'A valid status is required', details: parsed.error.issues });
    return;
  }

  try {
    const db = req.app.get('db') as Knex;
    const repo = new ClaimRepository(db);
    const claim = await repo.getClaim(req.auth.agencyId, String(req.params.id));
    if (!claim) {
      res.status(404).json({ message: 'Claim not found' });
      return;
    }

    const next = parsed.data.status;
    if (!canTransitionClaim(claim.status, next)) {
      res.status(422).json({ message: `Cannot transition claim from "${claim.status}" to "${next}"` });
      return;
    }

    const submittedAt = next === 'submitted' ? new Date().toISOString() : undefined;
    const updated = await repo.updateStatus(req.auth.agencyId, claim.id as string, {
      status: next,
      statusReason: parsed.data.statusReason ?? null,
      payerClaimId: parsed.data.payerClaimId ?? undefined,
      submittedAt,
    });

    await audit(
      db,
      req,
      next === 'submitted' ? 'claim.submitted' : 'claim.status-changed',
      claim.id as string,
      { from: claim.status, to: next },
    );
    res.json(toClaimDetailResponse(updated as Claim));
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /billing/claims/:id/837, download the X12 837P for one claim
// ─────────────────────────────────────────────────────────────────────────────
router.get('/claims/:id/837', requireCapability('billing.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new ClaimRepository(db);
    const claim = await repo.getClaim(req.auth.agencyId, String(req.params.id));
    if (!claim) {
      res.status(404).json({ message: 'Claim not found' });
      return;
    }

    const built = await build837ForClaim(db, req.auth.agencyId, claim);
    if (built.kind === 'no_profile') {
      res.status(404).json({ message: 'Agency billing profile not found' });
      return;
    }
    if (built.kind === 'profile_incomplete') {
      res.status(422).json({
        message: `Agency billing profile is incomplete, set ${built.missing.join(', ')} under Settings → Billing & Clearinghouse before generating an 837.`,
        code: 'BILLING_PROFILE_INCOMPLETE',
        missing: built.missing,
      });
      return;
    }

    // 837 contains member ids + names + DOB → a PHI export.
    await audit(db, req, 'phi.export', claim.id as string, {
      artifact: '837P',
      claimControlNumber: claim.controlNumber,
      lineCount: claim.lines.length,
    });

    res.setHeader('Content-Type', 'application/edi-x12');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="claim-${claim.controlNumber ?? claim.id}.837.txt"`,
    );
    res.send(built.edi);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /billing/claims/:id/submit, automated clearinghouse transmission
// ─────────────────────────────────────────────────────────────────────────────
router.post('/claims/:id/submit', requireCapability('billing.write'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const repo = new ClaimRepository(db);
    const claim = await repo.getClaim(req.auth.agencyId, String(req.params.id));
    if (!claim) {
      res.status(404).json({ message: 'Claim not found' });
      return;
    }

    // Only ready claims may transmit. A rejected or denied claim goes back
    // through /validate to ready first, keeping one gatekeeper for risk checks.
    if (!canTransitionClaim(claim.status, 'submitted')) {
      res.status(422).json({ message: `Cannot submit a claim in "${claim.status}" status` });
      return;
    }

    const built = await build837ForClaim(db, req.auth.agencyId, claim);
    if (built.kind === 'no_profile') {
      res.status(404).json({ message: 'Agency billing profile not found' });
      return;
    }
    if (built.kind === 'profile_incomplete') {
      res.status(422).json({
        message: `Agency billing profile is incomplete, set ${built.missing.join(', ')} under Settings → Billing & Clearinghouse before submitting.`,
        code: 'BILLING_PROFILE_INCOMPLETE',
        missing: built.missing,
      });
      return;
    }

    const transportResult = await buildTransportForAgency(db, req.auth.agencyId);
    if (transportResult.kind === 'not_configured') {
      res.status(409).json({ code: 'CLEARINGHOUSE_NOT_CONFIGURED', message: transportResult.reason });
      return;
    }

    const sent = await transportResult.transport.submit(built.edi, { controlNumber: built.controlNumber });
    if (sent.kind === 'error') {
      await audit(db, req, 'claim.submitted', claim.id as string, {
        automated: true,
        transport: transportResult.transportName,
        outcome: 'failure',
        retryable: sent.retryable,
      });
      res.status(502).json({ message: sent.message, retryable: sent.retryable });
      return;
    }

    const updated = await repo.updateStatus(req.auth.agencyId, claim.id as string, {
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      transportReference: sent.reference,
    });

    await audit(db, req, 'claim.submitted', claim.id as string, {
      automated: true,
      transport: transportResult.transportName,
      reference: sent.reference,
    });
    // An automated transmission is a PHI disclosure, exactly like the download.
    await audit(db, req, 'phi.export', claim.id as string, {
      artifact: '837P',
      destination: transportResult.transportName,
      claimControlNumber: built.controlNumber,
      lineCount: claim.lines.length,
    });

    res.json({ ...toClaimDetailResponse(updated as Claim), reference: sent.reference });
  } catch (err) {
    safeError('claim submit failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /billing/payroll/export?from=&to=, payroll CSV from verified hours
// ─────────────────────────────────────────────────────────────────────────────
router.get('/payroll/export', requireCapability('billing.read'), async (req: Request, res: Response) => {
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    res.status(400).json({ message: 'from and to (YYYY-MM-DD) query params are required' });
    return;
  }
  if (from > to) {
    res.status(400).json({ message: 'from must be on or before to' });
    return;
  }

  try {
    const db = req.app.get('db') as Knex;
    const repo = new ClaimRepository(db);
    const visits = await repo.getPayrollVisits(req.auth.agencyId, startOfDayIso(from), endOfDayIso(to));
    const result = buildPayrollExport(visits, { periodStart: from, periodEnd: to });

    await audit(db, req, 'payroll.exported', req.auth.agencyId, {
      from,
      to,
      caregivers: result.rows.length,
      totalHours: result.totalHours,
      excludedVisits: result.excludedVisits,
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-${from}_to_${to}.csv"`);
    res.send(result.csv);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ── response shaping ─────────────────────────────────────────────────────────

function toClaimResponse(claim: Claim | (Omit<Claim, 'lines'> & { lineCount?: number })): Record<string, unknown> {
  return {
    id: claim.id,
    clientId: claim.clientId,
    payerId: claim.payerId,
    periodStart: claim.periodStart,
    periodEnd: claim.periodEnd,
    status: claim.status,
    totalUnits: claim.totalUnits,
    totalChargeCents: claim.totalChargeCents,
    denialRisk: claim.denialRisk,
    controlNumber: claim.controlNumber,
    lineCount: 'lineCount' in claim ? claim.lineCount : (claim as Claim).lines?.length ?? 0,
    createdAt: claim.createdAt,
    updatedAt: claim.updatedAt,
  };
}

function toClaimDetailResponse(claim: Claim): Record<string, unknown> {
  return {
    ...toClaimResponse(claim),
    payerClaimId: claim.payerClaimId,
    statusReason: claim.statusReason,
    transportReference: claim.transportReference ?? null,
    submittedAt: claim.submittedAt,
    lines: claim.lines.map((l) => ({
      id: l.id,
      visitId: l.visitId,
      serviceCode: l.serviceCode,
      serviceDescription: paServiceCodeDescriptions[l.serviceCode],
      serviceDate: l.serviceDate,
      units: l.units,
      minutes: l.minutes,
      chargeCents: l.chargeCents,
      denialRisk: l.denialRisk,
      denialReasons: l.denialReasons,
    })),
  };
}

// ── ERA / 835 remittance posting ────────────────────────────────────────────

/** CAS adjustment decorated with the CARC dictionary for display. */
function decorateAdjustment(a: Era835Adjustment) {
  return {
    ...a,
    groupLabel: adjustmentGroupLabel(a.group),
    description: describeCarc(a.reasonCode),
  };
}

/** RARC decorated with its dictionary description. */
function decorateRemark(code: string) {
  return { code, description: describeRarc(code) };
}

/** SVC service line decorated for display (adjustments + remarks described). */
function decorateServiceLine(l: Era835ServiceLine) {
  return {
    ...l,
    adjustments: l.adjustments.map(decorateAdjustment),
    remarkCodes: l.remarkCodes.map(decorateRemark),
  };
}

/** GET /billing/remittances, recent remittance postings. */
router.get('/remittances', requireCapability('billing.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const list = await new ClaimRepository(db).listRemittances(req.auth.agencyId);
    res.json(
      list.map((r) => ({
        ...r,
        adjustments: r.adjustments.map(decorateAdjustment),
        remarkCodes: r.remarkCodes.map(decorateRemark),
        serviceLines: (r.serviceLines as Era835ServiceLine[]).map(decorateServiceLine),
      })),
    );
  } catch (err) {
    safeError('list remittances failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * POST /billing/remittances/preview, parse an 835 and report, per claim,
 * whether its control number matches one of our claims. No writes.
 */
router.post(
  '/remittances/preview',
  requireCapability('billing.write'),
  eraText,
  async (req: Request, res: Response) => {
    const text = typeof req.body === 'string' ? req.body : '';
    if (!text.trim()) {
      res.status(400).json({ message: 'request body must be an 835 file (content-type text/plain)' });
      return;
    }
    let era;
    try {
      era = parse835(text);
    } catch (err) {
      res.status(400).json({ message: err instanceof Error ? err.message : 'Could not parse 835' });
      return;
    }
    try {
      const db = req.app.get('db') as Knex;
      const matchedSet = await new ClaimRepository(db).matchControlNumbers(
        req.auth.agencyId,
        era.claims.map((c) => c.controlNumber),
      );
      res.json({
        traceNumber: era.traceNumber,
        totalPaidCents: era.totalPaidCents,
        total: era.claims.length,
        matchedCount: era.claims.filter((c) => matchedSet.has(c.controlNumber)).length,
        claims: era.claims.map((c) => ({
          controlNumber: c.controlNumber,
          matched: matchedSet.has(c.controlNumber),
          derivedStatus: c.derivedStatus,
          chargeCents: c.chargeCents,
          paidCents: c.paidCents,
          patientResponsibilityCents: c.patientResponsibilityCents,
          adjustments: c.adjustments.map(decorateAdjustment),
          remarkCodes: c.remarkCodes.map(decorateRemark),
          serviceLines: c.lines.map(decorateServiceLine),
        })),
      });
    } catch (err) {
      safeError('remittance preview failed', err);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },
);

/**
 * POST /billing/remittances/post, parse an 835 and post it: record each
 * remittance and advance matched claims (paid / denied / rejected).
 */
router.post(
  '/remittances/post',
  requireCapability('billing.write'),
  eraText,
  async (req: Request, res: Response) => {
    const text = typeof req.body === 'string' ? req.body : '';
    if (!text.trim()) {
      res.status(400).json({ message: 'request body must be an 835 file (content-type text/plain)' });
      return;
    }
    let era;
    try {
      era = parse835(text);
    } catch (err) {
      res.status(400).json({ message: err instanceof Error ? err.message : 'Could not parse 835' });
      return;
    }
    try {
      const db = req.app.get('db') as Knex;
      const result = await new ClaimRepository(db).postEra(req.auth.agencyId, era);

      try {
        await new AuditEventRepository(db).create({
          agencyId: req.auth.agencyId,
          actorId: req.auth.userId,
          actorType: 'user',
          eventType: 'claim.remittance.posted',
          entityType: 'remittance',
          entityId: req.auth.agencyId,
          outcome: 'success',
          payload: {
            posted: result.posted,
            matched: result.matched,
            unmatched: result.unmatched.length,
            traceNumber: era.traceNumber,
            totalPaidCents: era.totalPaidCents,
          },
          occurredAt: new Date().toISOString(),
        });
      } catch (err) {
        safeError('Failed to audit claim.remittance.posted', err);
      }

      res.json({ ...result, totalPaidCents: era.totalPaidCents, traceNumber: era.traceNumber });
    } catch (err) {
      safeError('remittance post failed', err);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET|POST /billing/remittances/sweep, automated 835 retrieval
//
// Vercel Cron invokes the path with GET and `Authorization: Bearer
// <CRON_SECRET>`; the web UI's "Fetch now" button POSTs with a privileged
// session. The cron path sweeps every enabled agency; a human sweeps only
// their own. Time-boxed to stay well inside the serverless duration cap.
// ─────────────────────────────────────────────────────────────────────────────
async function handleRemittanceSweep(req: Request, res: Response): Promise<void> {
  const cronAuthorized = assertCronAuthorized(req);
  const human = req.auth ? hasCapability(req.auth.role, 'billing.write') : false;
  if (!cronAuthorized && !human) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  try {
    const db = req.app.get('db') as Knex;
    const agencyIds = cronAuthorized
      ? await new AgencyClearinghouseConfigRepository(db).listEnabledAgencyIds()
      : [req.auth.agencyId];
    const summary = await runRemittanceSweep(db, {
      agencyIds,
      maxFilesPerAgency: 5,
      deadlineMs: Date.now() + 20_000,
    });
    res.json(summary);
  } catch (err) {
    safeError('remittance sweep failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
router.get('/remittances/sweep', handleRemittanceSweep);
router.post('/remittances/sweep', handleRemittanceSweep);

/** GET /billing/remittances/files, ledger of automatically ingested 835 files. */
router.get('/remittances/files', requireCapability('billing.read'), async (req: Request, res: Response) => {
  try {
    const db = req.app.get('db') as Knex;
    const files = await new ClearinghouseRemittanceFileRepository(db).list(req.auth.agencyId);
    res.json(files);
  } catch (err) {
    safeError('list remittance files failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
