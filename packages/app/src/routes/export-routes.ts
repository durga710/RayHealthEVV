import { Router } from 'express';
import { z } from 'zod';
import {
  AuditEventRepository,
  EvvRepository,
  ClientRepository,
  CaregiverRepository,
  AgencyHhaexchangeConfigRepository,
  AgencySandataConfigRepository,
  SandataClient,
  SandataAltEvv,
  HhaexchangeClient,
  buildHhaexchangeExport,
  toHhaexchangeCsv,
  type HhaexchangeVisitInput,
  type VisitSubmission,
  type Client,
  type Caregiver,
  type EvvVisit,
} from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';

const router = Router();

const isYmdOrIso = (v: string | undefined) => !v || /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v);

const submitSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const reconcileSchema = z.object({
  results: z
    .array(
      z.object({
        visitId: z.string().uuid(),
        status: z.enum(['pending', 'submitted', 'accepted', 'rejected']),
        confirmationId: z.string().max(128).nullable().optional(),
      }),
    )
    .min(1)
    .max(1000),
});

/** Escape one CSV cell per RFC 4180. */
function csvCell(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * GET /exports/visits.csv?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * RFC-4180 CSV with all seven Cures-Act EVV data points (plus visit_id and
 * status). Tenant-scoped inside the repository. The auditLog middleware
 * records this as a PHI read (path matches /exports, treated as PHI in
 * audit-log's PHI_GET_PATHS in a follow-up update if not already).
 */
router.get('/visits.csv', requireCapability('billing.read'), async (req, res) => {
  try {
    const fromRaw = typeof req.query.from === 'string' ? req.query.from : undefined;
    const toRaw = typeof req.query.to === 'string' ? req.query.to : undefined;
    const isDate = (v: string | undefined) => !v || /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v);
    if (!isDate(fromRaw) || !isDate(toRaw)) {
      return res.status(400).json({ message: 'from / to must be YYYY-MM-DD or ISO 8601' });
    }
    const fromIso = fromRaw ? new Date(fromRaw).toISOString() : undefined;
    const toIso = toRaw ? new Date(`${toRaw}T23:59:59.999Z`).toISOString() : undefined;

    const repo = new EvvRepository(req.app.get('db'));
    const rows = await repo.getVisitsForExport(req.auth.agencyId, fromIso, toIso);

    const header = [
      'visit_id',
      'service_code',
      'client_id',
      'caregiver_id',
      'service_date',
      'start_time',
      'end_time',
      'location_lat',
      'location_lng',
      'location_accuracy',
      'status'
    ];

    const lines: string[] = [header.join(',')];
    for (const row of rows) {
      const loc = (row.clockInLocation ?? {}) as { lat?: number; lng?: number; accuracy?: number };
      lines.push(
        [
          row.visitId,
          row.serviceCode ?? '',
          row.clientId ?? '',
          row.caregiverId,
          row.clockInTime.slice(0, 10),
          row.clockInTime,
          row.clockOutTime ?? '',
          loc.lat ?? '',
          loc.lng ?? '',
          loc.accuracy ?? '',
          row.status
        ]
          .map(csvCell)
          .join(',')
      );
    }

    const body = lines.join('\n') + '\n';
    const filename = `rayhealth-visits-${req.auth.agencyId.slice(0, 8)}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (err) {
    safeError('visits.csv export failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * GET /exports/sandata.csv?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Sandata-aggregator-shaped EVV submission export. Produces RFC-4180
 * CSV in the column order the Sandata "EVV Provider Self-Service
 * Visit Maintenance" import accepts. Tenant-scoped to the caller's
 * agency. PHI read; auditLog middleware records access.
 *
 * This is a SKELETON — the column set is the federally-required Cures
 * Act 6 data points plus client/worker names and verification method.
 * Production deploys will need:
 *   1. The agency's Sandata Provider ID prepended as a row prefix.
 *   2. Sandata's Worker ID (often last-4-SSN) instead of caregiver UUID
 *      — the worker_external_id field needs adding to caregivers.
 *   3. Sandata's HCPCS-modifier table mapped from our service codes.
 *   4. Schema version + checksum row per Sandata's import contract.
 *
 * The skeleton ships now so agencies can dry-run their submission flow
 * end-to-end with their account managers; the missing pieces above are
 * tracked in docs/RELEASE_PREP_GAPS.md MED-priority items.
 */
router.get('/sandata.csv', requireCapability('billing.read'), async (req, res) => {
  try {
    const fromRaw = typeof req.query.from === 'string' ? req.query.from : undefined;
    const toRaw = typeof req.query.to === 'string' ? req.query.to : undefined;
    const isDate = (v: string | undefined) => !v || /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v);
    if (!isDate(fromRaw) || !isDate(toRaw)) {
      return res.status(400).json({ message: 'from / to must be YYYY-MM-DD or ISO 8601' });
    }
    const fromIso = fromRaw ? new Date(fromRaw).toISOString() : undefined;
    const toIso = toRaw ? new Date(`${toRaw}T23:59:59.999Z`).toISOString() : undefined;

    const db = req.app.get('db');
    let q = db('evv_visits as v')
      .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
      .join('caregivers as cg', 'cg.id', 'v.caregiver_id')
      .leftJoin('assignments as a', 'a.id', 'v.assignment_id')
      .leftJoin('visit_templates as t', 't.id', 'a.visit_template_id')
      .leftJoin('clients as c', 'c.id', db.raw('coalesce(v.client_id, t.client_id)'))
      .where('u.agency_id', req.auth.agencyId)
      .select(
        'v.id as visit_id',
        'cg.id as worker_id',
        'cg.first_name as worker_first_name',
        'cg.last_name as worker_last_name',
        'c.id as client_id',
        'c.first_name as client_first_name',
        'c.last_name as client_last_name',
        'v.service_code',
        'a.scheduled_start_time',
        'a.scheduled_end_time',
        'v.clock_in_time',
        'v.clock_out_time',
        'v.clock_in_location',
        'v.clock_out_location',
        'v.status'
      )
      .orderBy('v.clock_in_time', 'asc');
    if (fromIso) q = q.andWhere('v.clock_in_time', '>=', fromIso);
    if (toIso) q = q.andWhere('v.clock_in_time', '<=', toIso);
    const rows = await q;

    const header = [
      'ClientID',
      'ClientFirstName',
      'ClientLastName',
      'WorkerID',
      'WorkerFirstName',
      'WorkerLastName',
      'ServiceCode',
      'VisitDate',
      'ScheduleStartTime',
      'ScheduleEndTime',
      'ActualStartTime',
      'ActualEndTime',
      'StartLatitude',
      'StartLongitude',
      'StartLocationVerification',
      'EndLatitude',
      'EndLongitude',
      'EndLocationVerification',
      'VisitStatus'
    ];

    const toIsoTime = (v: unknown): string => {
      if (!v) return '';
      const d = v instanceof Date ? v : new Date(String(v));
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    };
    const toIsoDate = (v: unknown): string => {
      if (!v) return '';
      const d = v instanceof Date ? v : new Date(String(v));
      return d.toISOString().slice(0, 10);
    };
    const parseLoc = (loc: unknown): { lat?: number; lng?: number } => {
      if (!loc) return {};
      const obj = typeof loc === 'string' ? (JSON.parse(loc) as Record<string, unknown>) : (loc as Record<string, unknown>);
      return { lat: obj.lat as number | undefined, lng: obj.lng as number | undefined };
    };

    const lines: string[] = [header.join(',')];
    for (const row of rows as Record<string, unknown>[]) {
      const startLoc = parseLoc(row.clock_in_location);
      const endLoc = parseLoc(row.clock_out_location);
      // Sandata expects a verification-method code — GPS for our
      // geofence path, PHONE for the telephony fallback. We don't
      // currently persist that; default to GPS when coords exist,
      // BLANK otherwise. Production must derive from a stored
      // verification_method column.
      const startVerif = startLoc.lat ? 'GPS' : '';
      const endVerif = endLoc.lat ? 'GPS' : '';
      lines.push(
        [
          row.client_id ?? '',
          row.client_first_name ?? '',
          row.client_last_name ?? '',
          row.worker_id ?? '',
          row.worker_first_name ?? '',
          row.worker_last_name ?? '',
          row.service_code ?? '',
          toIsoDate(row.clock_in_time),
          toIsoTime(row.scheduled_start_time),
          toIsoTime(row.scheduled_end_time),
          toIsoTime(row.clock_in_time),
          toIsoTime(row.clock_out_time),
          startLoc.lat ?? '',
          startLoc.lng ?? '',
          startVerif,
          endLoc.lat ?? '',
          endLoc.lng ?? '',
          endVerif,
          row.status ?? ''
        ]
          .map(csvCell)
          .join(',')
      );
    }

    const body = lines.join('\n') + '\n';
    const filename = `rayhealth-sandata-${req.auth.agencyId.slice(0, 8)}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (err) {
    safeError('sandata.csv export failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * POST /exports/sandata/submit  { from?, to? }
 *
 * Transmits every verified visit in the date range to the agency's Sandata
 * aggregator over its API and records the per-visit acknowledgments. Returns
 * `not_configured` (409) when the agency has not finished Sandata setup — no
 * endpoint / Provider ID / credentials — so a half-configured agency never
 * believes a batch was sent. On a transport failure returns `error` (502) with
 * whether a retry is sane; on success records each ack onto the visit and
 * audits the batch.
 */
router.post('/sandata/submit', requireCapability('billing.write'), async (req, res) => {
  const parsed = submitSchema.safeParse(req.body ?? {});
  if (!parsed.success || !isYmdOrIso(parsed.data.from) || !isYmdOrIso(parsed.data.to)) {
    return res.status(400).json({ message: 'from / to must be YYYY-MM-DD or ISO 8601' });
  }
  try {
    const { from, to } = parsed.data;
    const fromIso = from ? new Date(from).toISOString() : undefined;
    const toIso = to ? new Date(`${to.length === 10 ? `${to}T23:59:59.999Z` : to}`).toISOString() : undefined;

    const db = req.app.get('db');
    const config = await new AgencySandataConfigRepository(db).findSubmissionConfig(req.auth.agencyId);
    if (!config) {
      return res
        .status(409)
        .json({ status: 'not_configured', reason: 'Sandata integration has not been set up for this agency' });
    }

    const rows = await new EvvRepository(db).getVisitsForExport(req.auth.agencyId, fromIso, toIso);
    const visits: VisitSubmission[] = rows
      .filter((r) => r.status === 'verified')
      .map((r) => {
        const inLoc = (r.clockInLocation ?? {}) as { lat?: number; lng?: number };
        const outLoc = (r.clockOutLocation ?? {}) as { lat?: number; lng?: number };
        return {
          visitId: r.visitId,
          clientId: r.clientId ?? '',
          caregiverId: r.caregiverId,
          serviceCode: r.serviceCode ?? '',
          clockInAt: r.clockInTime,
          clockOutAt: r.clockOutTime,
          clockInLat: inLoc.lat ?? null,
          clockInLng: inLoc.lng ?? null,
          clockOutLat: outLoc.lat ?? null,
          clockOutLng: outLoc.lng ?? null,
          verificationMethod: inLoc.lat != null ? 'gps' : 'manual',
        };
      });

    const result = await SandataClient.submitVisits(config, visits);
    if (result.kind === 'not_configured') {
      return res.status(409).json({ status: 'not_configured', reason: result.reason });
    }
    if (result.kind === 'error') {
      return res.status(502).json({ status: 'error', message: result.message, retryable: result.retryable });
    }

    // Record each Sandata acknowledgment back onto the originating visit.
    const repo = new EvvRepository(db);
    let submitted = 0;
    let accepted = 0;
    let rejected = 0;
    for (const ack of result.acks) {
      await repo.markSandataSubmission(ack.visitId, req.auth.agencyId, ack.status, ack.confirmationId ?? undefined);
      if (ack.status === 'accepted') accepted += 1;
      else if (ack.status === 'rejected') rejected += 1;
      else submitted += 1;
    }

    try {
      await new AuditEventRepository(db).create({
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'evv.sandata.submitted',
        entityType: 'evv_batch',
        entityId: req.auth.agencyId,
        outcome: 'success',
        payload: { batchId: result.batchId, submitted, accepted, rejected, from: from ?? null, to: to ?? null },
        occurredAt: new Date().toISOString(),
      });
    } catch (err) {
      safeError('Failed to audit evv.sandata.submitted', err);
    }

    res.json({ status: 'ok', batchId: result.batchId, submitted, accepted, rejected });
  } catch (err) {
    safeError('sandata submit failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * POST /exports/sandata/reconcile  { results: [{ visitId, status, confirmationId? }] }
 *
 * Applies the aggregator's response file back onto each visit — typically
 * `accepted` (clears the denial-risk flag) or `rejected` (raises it to high).
 * Each update is tenant-scoped inside the repository; unknown / cross-agency
 * visit ids are counted as `notFound` rather than failing the whole batch.
 */
router.post('/sandata/reconcile', requireCapability('billing.write'), async (req, res) => {
  const parsed = reconcileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: 'results must be a non-empty array of { visitId, status }',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  try {
    const db = req.app.get('db');
    const repo = new EvvRepository(db);

    let updated = 0;
    const notFound: string[] = [];
    for (const r of parsed.data.results) {
      const ok = await repo.markSandataSubmission(
        r.visitId,
        req.auth.agencyId,
        r.status,
        r.confirmationId ?? undefined,
      );
      if (ok) updated += 1;
      else notFound.push(r.visitId);
    }

    try {
      await new AuditEventRepository(db).create({
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'evv.sandata.reconciled',
        entityType: 'evv_batch',
        entityId: req.auth.agencyId,
        outcome: 'success',
        payload: { updated, notFound: notFound.length },
        occurredAt: new Date().toISOString(),
      });
    } catch (err) {
      safeError('Failed to audit evv.sandata.reconciled', err);
    }

    res.json({ updated, notFound });
  } catch (err) {
    safeError('sandata reconcile failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * GET /exports/hhaexchange.csv?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * HHAeXchange-aggregator-shaped EVV export, for agencies whose state routes
 * EVV through HHAeXchange instead of Sandata. Unlike the Sandata skeleton this
 * uses the config-driven builder (services/hhaexchange-mapping.ts): the
 * agency's HHAeXchange config supplies AgencyTaxID / ProviderID, the caregiver
 * → EmployeeID map, and the service-code map. Visits with no mapping (or no
 * clock-out) are skipped and reported in the `X-Skipped` header rather than
 * silently dropped. A valid config is REQUIRED — without it we 422 (mirrors the
 * 837 download guard) so the operator knows to finish HHAeXchange setup first.
 *
 * Member ID = the client's import `external_id` (the source-system id, which is
 * the HHAeXchange Member ID for imported clients), falling back to the client
 * UUID for hand-entered clients.
 */
router.get('/hhaexchange.csv', requireCapability('billing.read'), async (req, res) => {
  try {
    const fromRaw = typeof req.query.from === 'string' ? req.query.from : undefined;
    const toRaw = typeof req.query.to === 'string' ? req.query.to : undefined;
    const isDate = (v: string | undefined) => !v || /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v);
    if (!isDate(fromRaw) || !isDate(toRaw)) {
      return res.status(400).json({ message: 'from / to must be YYYY-MM-DD or ISO 8601' });
    }
    const fromIso = fromRaw ? new Date(fromRaw).toISOString() : undefined;
    const toIso = toRaw ? new Date(`${toRaw}T23:59:59.999Z`).toISOString() : undefined;

    const db = req.app.get('db');
    const config = await new AgencyHhaexchangeConfigRepository(db).findValid(req.auth.agencyId);
    if (!config) {
      return res.status(422).json({
        message:
          'HHAeXchange is not fully configured for this agency. Set the Tax ID, Provider ID, caregiver and service-code mappings before exporting.',
      });
    }

    let q = db('evv_visits as v')
      .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
      .leftJoin('assignments as a', 'a.id', 'v.assignment_id')
      .leftJoin('visit_templates as t', 't.id', 'a.visit_template_id')
      .leftJoin('clients as c', 'c.id', db.raw('coalesce(v.client_id, t.client_id)'))
      .where('u.agency_id', req.auth.agencyId)
      .select(
        'v.id as visit_id',
        'v.caregiver_id',
        'c.id as client_id',
        'c.external_id as client_external_id',
        'c.first_name as client_first_name',
        'c.last_name as client_last_name',
        'v.service_code',
        'v.clock_in_time',
        'v.clock_out_time',
        'v.clock_in_location',
        'v.clock_out_location',
      )
      .orderBy('v.clock_in_time', 'asc');
    if (fromIso) q = q.andWhere('v.clock_in_time', '>=', fromIso);
    if (toIso) q = q.andWhere('v.clock_in_time', '<=', toIso);
    const rows = await q;

    const toIso8601 = (v: unknown): string => {
      if (!v) return '';
      return v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();
    };
    const parseLoc = (loc: unknown): { lat?: number; lng?: number } => {
      if (!loc) return {};
      const obj = typeof loc === 'string' ? (JSON.parse(loc) as Record<string, unknown>) : (loc as Record<string, unknown>);
      return { lat: obj.lat as number | undefined, lng: obj.lng as number | undefined };
    };

    const visits: HhaexchangeVisitInput[] = (rows as Record<string, unknown>[]).map((r) => {
      const inLoc = parseLoc(r.clock_in_location);
      const outLoc = parseLoc(r.clock_out_location);
      return {
        visitId: r.visit_id as string,
        caregiverId: r.caregiver_id as string,
        memberId: (r.client_external_id as string | null) ?? (r.client_id as string | null) ?? '',
        clientFirstName: (r.client_first_name as string | null) ?? '',
        clientLastName: (r.client_last_name as string | null) ?? '',
        clockInIso: toIso8601(r.clock_in_time),
        clockOutIso: r.clock_out_time ? toIso8601(r.clock_out_time) : null,
        internalServiceCode: (r.service_code as string | null) ?? '',
        clockInLat: inLoc.lat ?? 0,
        clockInLng: inLoc.lng ?? 0,
        clockOutLat: outLoc.lat ?? null,
        clockOutLng: outLoc.lng ?? null,
      };
    });

    const { rows: csvRows, skipped } = buildHhaexchangeExport(visits, config);
    const body = toHhaexchangeCsv(csvRows);
    const filename = `rayhealth-hhaexchange-${req.auth.agencyId.slice(0, 8)}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Skipped', String(skipped.length));
    res.send(body);
  } catch (err) {
    safeError('hhaexchange.csv export failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * POST /exports/hhaexchange/submit  { from?, to? }
 *
 * HHAeXchange analogue of /sandata/submit. Transmits every verified visit in
 * the range to the agency's HHAeXchange connection. Returns not_configured(409)
 * when setup is incomplete; on success records each acknowledgment. (The
 * HHAeXchange transport is currently a scaffold, so a fully-configured agency
 * receives a clear `error` until the real transport lands — never a fake mark.)
 */
router.post('/hhaexchange/submit', requireCapability('billing.write'), async (req, res) => {
  const parsed = submitSchema.safeParse(req.body ?? {});
  if (!parsed.success || !isYmdOrIso(parsed.data.from) || !isYmdOrIso(parsed.data.to)) {
    return res.status(400).json({ message: 'from / to must be YYYY-MM-DD or ISO 8601' });
  }
  try {
    const { from, to } = parsed.data;
    const fromIso = from ? new Date(from).toISOString() : undefined;
    const toIso = to ? new Date(`${to.length === 10 ? `${to}T23:59:59.999Z` : to}`).toISOString() : undefined;

    const db = req.app.get('db');
    const config = await new AgencyHhaexchangeConfigRepository(db).findSubmissionConfig(req.auth.agencyId);
    if (!config) {
      return res
        .status(409)
        .json({ status: 'not_configured', reason: 'HHAeXchange integration has not been set up for this agency' });
    }

    const rows = await new EvvRepository(db).getVisitsForExport(req.auth.agencyId, fromIso, toIso);
    const visits: VisitSubmission[] = rows
      .filter((r) => r.status === 'verified')
      .map((r) => {
        const inLoc = (r.clockInLocation ?? {}) as { lat?: number; lng?: number };
        const outLoc = (r.clockOutLocation ?? {}) as { lat?: number; lng?: number };
        return {
          visitId: r.visitId,
          clientId: r.clientId ?? '',
          caregiverId: r.caregiverId,
          serviceCode: r.serviceCode ?? '',
          clockInAt: r.clockInTime,
          clockOutAt: r.clockOutTime,
          clockInLat: inLoc.lat ?? null,
          clockInLng: inLoc.lng ?? null,
          clockOutLat: outLoc.lat ?? null,
          clockOutLng: outLoc.lng ?? null,
          verificationMethod: inLoc.lat != null ? 'gps' : 'manual',
        };
      });

    const result = await HhaexchangeClient.submitVisits(config, visits);
    if (result.kind === 'not_configured') {
      return res.status(409).json({ status: 'not_configured', reason: result.reason });
    }
    if (result.kind === 'error') {
      return res.status(502).json({ status: 'error', message: result.message, retryable: result.retryable });
    }

    const repo = new EvvRepository(db);
    let submitted = 0;
    let accepted = 0;
    let rejected = 0;
    for (const ack of result.acks) {
      await repo.markHhaexchangeSubmission(ack.visitId, req.auth.agencyId, ack.status, ack.confirmationId ?? undefined);
      if (ack.status === 'accepted') accepted += 1;
      else if (ack.status === 'rejected') rejected += 1;
      else submitted += 1;
    }

    try {
      await new AuditEventRepository(db).create({
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'evv.hhaexchange.submitted',
        entityType: 'evv_batch',
        entityId: req.auth.agencyId,
        outcome: 'success',
        payload: { batchId: result.batchId, submitted, accepted, rejected, from: from ?? null, to: to ?? null },
        occurredAt: new Date().toISOString(),
      });
    } catch (err) {
      safeError('Failed to audit evv.hhaexchange.submitted', err);
    }

    res.json({ status: 'ok', batchId: result.batchId, submitted, accepted, rejected });
  } catch (err) {
    safeError('hhaexchange submit failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * POST /exports/hhaexchange/reconcile  { results: [{ visitId, status, confirmationId? }] }
 *
 * HHAeXchange analogue of /sandata/reconcile. Applies the aggregator's response
 * back onto each visit; tenant-scoped; unknown ids counted as notFound.
 */
router.post('/hhaexchange/reconcile', requireCapability('billing.write'), async (req, res) => {
  const parsed = reconcileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: 'results must be a non-empty array of { visitId, status }',
      issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  try {
    const db = req.app.get('db');
    const repo = new EvvRepository(db);

    let updated = 0;
    const notFound: string[] = [];
    for (const r of parsed.data.results) {
      const ok = await repo.markHhaexchangeSubmission(
        r.visitId,
        req.auth.agencyId,
        r.status,
        r.confirmationId ?? undefined,
      );
      if (ok) updated += 1;
      else notFound.push(r.visitId);
    }

    try {
      await new AuditEventRepository(db).create({
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'evv.hhaexchange.reconciled',
        entityType: 'evv_batch',
        entityId: req.auth.agencyId,
        outcome: 'success',
        payload: { updated, notFound: notFound.length },
        occurredAt: new Date().toISOString(),
      });
    } catch (err) {
      safeError('Failed to audit evv.hhaexchange.reconciled', err);
    }

    res.json({ updated, notFound });
  } catch (err) {
    safeError('hhaexchange reconcile failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// ── Sandata Alternate-EVV (real async POST→UUID→poll) ───────────────────────
// Supersedes the synchronous /sandata/submit above. Transmits CLIENT → EMPLOYEE
// → VISIT records in Sandata's required load order; visits whose client/employee
// are not yet VERIFIED defer until a later /poll verifies them. State lives in
// the R26 sandata_* tables.

type AltEvvConfigResult =
  | { ok: true; config: SandataAltEvv.SandataAltEvvConfig }
  | { ok: false; reason: string };

/** Build a real Alt-EVV transport config from the stored (decrypted) Sandata config. */
function buildAltEvvConfig(cfg: SandataClient.SandataClientConfig | undefined): AltEvvConfigResult {
  if (!cfg) return { ok: false, reason: 'Sandata integration has not been set up for this agency' };
  if (!cfg.enabled) return { ok: false, reason: 'Sandata integration is disabled for this agency' };
  if (!cfg.apiBaseUrl) return { ok: false, reason: 'No Sandata API base URL configured' };
  const creds = cfg.credentials;
  if (!creds || !creds.username || !creds.password) {
    return { ok: false, reason: 'Sandata Alternate-EVV requires a username and password credential' };
  }
  return {
    ok: true,
    config: {
      baseUrl: cfg.apiBaseUrl,
      username: creds.username,
      password: creds.password,
      entityGuid: creds.entityGuid,
      maxBatchSize: 5000,
      statusPollDelayMs: 300_000,
      environment: /prod/i.test(cfg.apiBaseUrl) ? 'PROD' : 'UAT',
    },
  };
}

interface ExportVisitRow {
  visitId: string;
  serviceCode: string | null;
  clientId: string | null;
  caregiverId: string;
  clockInTime: string;
  clockOutTime: string | null;
  clockInLocation: unknown;
  clockOutLocation: unknown;
  status: string;
}

function toLocation(raw: unknown): { lat: number; lng: number; accuracy: number } | undefined {
  const loc = (raw ?? {}) as { lat?: number; lng?: number; accuracy?: number };
  if (loc.lat == null || loc.lng == null) return undefined;
  return { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy ?? 0 };
}

/** Adapt an export row to an EvvVisit for the mapper/validator. */
function adaptVisit(row: ExportVisitRow): EvvVisit {
  return {
    id: row.visitId,
    // Export rows do not carry assignmentId; it is never transmitted to Sandata.
    assignmentId: row.visitId,
    caregiverId: row.caregiverId,
    clientId: row.clientId ?? undefined,
    serviceCode: (row.serviceCode ?? undefined) as EvvVisit['serviceCode'],
    clockInTime: row.clockInTime,
    clockOutTime: row.clockOutTime ?? undefined,
    clockInLocation: toLocation(row.clockInLocation),
    clockOutLocation: toLocation(row.clockOutLocation),
    status: row.status as EvvVisit['status'],
  } as EvvVisit;
}

function summarizeTransmit(r: SandataAltEvv.TransmitResult) {
  return {
    posted: r.posted,
    uuid: r.uuid,
    blocked: r.blocked.length,
    deferred: r.deferred.length,
    error: r.error,
  };
}

/**
 * POST /exports/sandata/altevv/submit  { from?, to? }
 *
 * Transmits the verified visits in the range — and the clients + caregivers they
 * reference — to Sandata's Alternate-EVV API in load order. Returns a per-entity
 * summary (posted / blocked / deferred / uuid). 409 not_configured when setup is
 * incomplete; nothing is sent. Visits defer until their dependencies verify via
 * a subsequent /altevv/poll.
 */
router.post('/sandata/altevv/submit', requireCapability('billing.write'), async (req, res) => {
  const parsed = submitSchema.safeParse(req.body ?? {});
  if (!parsed.success || !isYmdOrIso(parsed.data.from) || !isYmdOrIso(parsed.data.to)) {
    return res.status(400).json({ message: 'from / to must be YYYY-MM-DD or ISO 8601' });
  }
  try {
    const { from, to } = parsed.data;
    const fromIso = from ? new Date(from).toISOString() : undefined;
    const toIso = to ? new Date(`${to.length === 10 ? `${to}T23:59:59.999Z` : to}`).toISOString() : undefined;

    const db = req.app.get('db');
    const agencyId = req.auth.agencyId;
    const cfg = await new AgencySandataConfigRepository(db).findSubmissionConfig(agencyId);
    const built = buildAltEvvConfig(cfg);
    if (!built.ok) return res.status(409).json({ status: 'not_configured', reason: built.reason });

    const api = new SandataAltEvv.SandataApiClient(built.config);
    const state = new SandataAltEvv.KnexSandataStateRepository(db);
    const svc = new SandataAltEvv.SandataTransmissionService(api, state, built.config.environment);

    const rows = (await new EvvRepository(db).getVisitsForExport(agencyId, fromIso, toIso)) as ExportVisitRow[];
    const verifiedRows = rows.filter((r) => r.status === 'verified');
    const visits = verifiedRows.map(adaptVisit);

    // Only transmit the clients + caregivers these visits actually reference.
    const clientIds = new Set(verifiedRows.map((r) => r.clientId).filter((id): id is string => Boolean(id)));
    const caregiverIds = new Set(verifiedRows.map((r) => r.caregiverId).filter(Boolean));
    const allClients = (await new ClientRepository(db).getClients(agencyId)) as Client[];
    const allCaregivers = (await new CaregiverRepository(db).findByAgency(agencyId)) as Caregiver[];
    const clients = allClients.filter((c) => c.id && clientIds.has(c.id));
    const caregivers = allCaregivers.filter((c) => c.id && caregiverIds.has(c.id));

    const clientResult = await svc.transmitClients(agencyId, clients);
    const employeeResult = await svc.transmitEmployees(agencyId, caregivers);
    const visitResult = await svc.transmitVisits(agencyId, visits);

    try {
      await new AuditEventRepository(db).create({
        agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'evv.sandata.altevv.submitted',
        entityType: 'evv_batch',
        entityId: agencyId,
        outcome: 'success',
        payload: {
          environment: built.config.environment,
          clients: summarizeTransmit(clientResult),
          employees: summarizeTransmit(employeeResult),
          visits: summarizeTransmit(visitResult),
          from: from ?? null,
          to: to ?? null,
        },
        occurredAt: new Date().toISOString(),
      });
    } catch (err) {
      safeError('Failed to audit evv.sandata.altevv.submitted', err);
    }

    res.json({
      status: 'ok',
      clients: summarizeTransmit(clientResult),
      employees: summarizeTransmit(employeeResult),
      visits: summarizeTransmit(visitResult),
    });
  } catch (err) {
    safeError('sandata altevv submit failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * POST /exports/sandata/altevv/poll
 *
 * Polls every pending Sandata transmission for its per-record results, applying
 * ACCEPTED → VERIFIED / REJECTED / EXCEPTION and queueing visit exceptions for
 * staff. Idempotent; run on a schedule. 409 not_configured when Sandata is unset.
 */
router.post('/sandata/altevv/poll', requireCapability('billing.write'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const agencyId = req.auth.agencyId;
    const cfg = await new AgencySandataConfigRepository(db).findSubmissionConfig(agencyId);
    const built = buildAltEvvConfig(cfg);
    if (!built.ok) return res.status(409).json({ status: 'not_configured', reason: built.reason });

    const api = new SandataAltEvv.SandataApiClient(built.config);
    const state = new SandataAltEvv.KnexSandataStateRepository(db);
    const svc = new SandataAltEvv.SandataTransmissionService(api, state, built.config.environment);

    const summary = await svc.pollPendingStatuses(agencyId);

    try {
      await new AuditEventRepository(db).create({
        agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'evv.sandata.altevv.polled',
        entityType: 'evv_batch',
        entityId: agencyId,
        outcome: 'success',
        payload: { ...summary },
        occurredAt: new Date().toISOString(),
      });
    } catch (err) {
      safeError('Failed to audit evv.sandata.altevv.polled', err);
    }

    res.json({ status: 'ok', ...summary });
  } catch (err) {
    safeError('sandata altevv poll failed', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
