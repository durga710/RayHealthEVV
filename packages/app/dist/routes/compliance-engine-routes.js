import { Router } from 'express';
import { z } from 'zod';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';
import { AUDIT_DEFENSE_PACKET_COLUMNS, AuditEventRepository, ComplianceEngineRepository, PA_BACKGROUND_CHECK_RENEWAL_YEARS, PA_DHS_AUDIT_RESPONSE_HOURS, PA_GRACE_PERIOD_MINUTES, PA_RETENTION_YEARS, PA_RN_SUPERVISION_CHC_DAYS, PA_SANDATA_SUBMISSION_WINDOW_DAYS, auditPacketRowToCsv, paComplianceCredentials, paExceptionTypes, } from '@rayhealth/core';
const router = Router();
/**
 * Accept either a full ISO datetime or a calendar-date string (YYYY-MM-DD).
 * The route normalises bare dates to the start/end of the day in UTC so
 * `whereBetween('occurred_at', [from, to])` captures everything on the to-day.
 */
const isoOrCalendarDate = z
    .string()
    .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) ||
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value), 'Date must be YYYY-MM-DD or full ISO datetime');
const previewQuerySchema = z.object({
    from: isoOrCalendarDate,
    to: isoOrCalendarDate,
});
function normalizeStart(input) {
    if (input.includes('T')) {
        return new Date(input).toISOString();
    }
    return new Date(`${input}T00:00:00.000Z`).toISOString();
}
function normalizeEnd(input) {
    if (input.includes('T')) {
        return new Date(input).toISOString();
    }
    return new Date(`${input}T23:59:59.999Z`).toISOString();
}
/**
 * GET /api/compliance-engine/audit-defense/preview?from=&to=
 *
 * Returns the size of a PA audit-defense packet for the authenticated agency
 * and the given date range — counts only, no PHI. Sized to the PA DHS 48-hour
 * response window (echoed in the `policy` block alongside the 7-year retention
 * floor).
 *
 * Capability: `audit.read` (admin-only today; coordinator may be granted
 * separately as the Engine matures).
 */
router.get('/audit-defense/preview', requireCapability('audit.read'), async (req, res) => {
    try {
        if (!req.auth.agencyId) {
            return res.status(403).json({ message: 'Agency context required' });
        }
        const parsed = previewQuerySchema.safeParse({
            from: req.query.from,
            to: req.query.to,
        });
        if (!parsed.success) {
            return res.status(400).json({
                message: 'A valid from/to date range is required (YYYY-MM-DD or ISO datetime)',
            });
        }
        const fromIso = normalizeStart(parsed.data.from);
        const toIso = normalizeEnd(parsed.data.to);
        if (Number.isNaN(Date.parse(fromIso)) || Number.isNaN(Date.parse(toIso))) {
            return res.status(400).json({ message: 'Invalid date range' });
        }
        if (fromIso > toIso) {
            return res
                .status(400)
                .json({ message: '`from` must be on or before `to`' });
        }
        const db = req.app.get('db');
        const repo = new ComplianceEngineRepository(db);
        const counts = await repo.getAuditDefensePreview(req.auth.agencyId, fromIso, toIso);
        res.json({
            agencyId: req.auth.agencyId,
            periodFrom: fromIso,
            periodTo: toIso,
            counts,
            policy: {
                retentionFloorYears: PA_RETENTION_YEARS,
                dhsResponseSlaHours: PA_DHS_AUDIT_RESPONSE_HOURS,
            },
        });
    }
    catch (error) {
        safeError('Audit defense preview failed:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
/**
 * GET /api/compliance-engine/audit-defense/packet.csv?from=&to=
 *
 * Streams a defensible PA audit-defense packet as CSV. One header row, then
 * one line per audit_event / VMUR / EVV visit in [from, to] for the requesting
 * agency, sorted by `occurred_at ASC, id ASC` so the manifest hash is stable.
 *
 * The X-Manifest-Sha256 response header contains a hex SHA-256 of the canonical
 * CSV (header + sorted body). Auditors can re-derive it from the file alone —
 * server signatures are not trusted in PA DHS audit contexts.
 *
 * Every successful download writes one `phi.export` audit event recording who
 * exported the packet, the period, the row counts, and the manifest hash. The
 * audit write must never block the user response — failures go to stderr.
 *
 * Capability: `audit.read` (admin-only today).
 */
router.get('/audit-defense/packet.csv', requireCapability('audit.read'), async (req, res) => {
    try {
        if (!req.auth.agencyId) {
            return res.status(403).json({ message: 'Agency context required' });
        }
        const parsed = previewQuerySchema.safeParse({
            from: req.query.from,
            to: req.query.to,
        });
        if (!parsed.success) {
            return res.status(400).json({
                message: 'A valid from/to date range is required (YYYY-MM-DD or ISO datetime)',
            });
        }
        const fromIso = normalizeStart(parsed.data.from);
        const toIso = normalizeEnd(parsed.data.to);
        if (Number.isNaN(Date.parse(fromIso)) || Number.isNaN(Date.parse(toIso))) {
            return res.status(400).json({ message: 'Invalid date range' });
        }
        if (fromIso > toIso) {
            return res
                .status(400)
                .json({ message: '`from` must be on or before `to`' });
        }
        const db = req.app.get('db');
        const repo = new ComplianceEngineRepository(db);
        const packet = await repo.buildAuditDefensePacket(req.auth.agencyId, fromIso, toIso);
        const headerLine = AUDIT_DEFENSE_PACKET_COLUMNS.join(',');
        const bodyLines = packet.rows.map((row) => auditPacketRowToCsv(row));
        const csv = bodyLines.length === 0
            ? `${headerLine}\n`
            : `${headerLine}\n${bodyLines.join('\n')}\n`;
        const fromDay = parsed.data.from.slice(0, 10);
        const toDay = parsed.data.to.slice(0, 10);
        const filename = `audit-defense-packet-${fromDay}-${toDay}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('X-Manifest-Sha256', packet.manifestSha256);
        res.setHeader('X-Packet-From', fromIso);
        res.setHeader('X-Packet-To', toIso);
        res.setHeader('X-Packet-Audit-Events', String(packet.counts.auditEvents));
        res.setHeader('X-Packet-Vmur-Records', String(packet.counts.vmurRecords));
        res.setHeader('X-Packet-Evv-Visits', String(packet.counts.evvVisits));
        res.setHeader('X-Packet-Active-Caregivers', String(packet.counts.activeCaregivers));
        res.status(200).send(csv);
        // Record the export so the regulator can trace who pulled the data and
        // when. Failures here are non-blocking — the user already has their file.
        try {
            await new AuditEventRepository(db).create({
                agencyId: req.auth.agencyId,
                actorId: req.auth.userId,
                actorType: 'user',
                eventType: 'phi.export',
                entityType: 'audit-defense-packet',
                entityId: req.auth.agencyId,
                outcome: 'success',
                payload: {
                    periodFrom: fromIso,
                    periodTo: toIso,
                    counts: packet.counts,
                    manifestSha256: packet.manifestSha256,
                    rowCount: packet.rows.length,
                },
            });
        }
        catch (auditErr) {
            process.stderr.write(`[audit-write-failed] phi.export audit-defense-packet agency=${req.auth.agencyId} ` +
                `error=${auditErr instanceof Error ? auditErr.message : String(auditErr)}\n`);
        }
    }
    catch (error) {
        safeError('Audit defense packet build failed:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
const oversightQuerySchema = z.object({
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
/**
 * GET /api/compliance-engine/authorizations/overview?asOf=YYYY-MM-DD
 *
 * Compliance lens on service authorizations: active count, near-term expiration
 * counts (14 d + 30 d), and recently-expired (last 14 d). Distinct from the
 * record-level CRUD route at /api/authorizations.
 *
 * `asOf` defaults to today (UTC). Capability `client.read` (admin + coordinator)
 * — coordinators run authorization workflows, so they get this lens too.
 */
router.get('/authorizations/overview', requireCapability('client.read'), async (req, res) => {
    try {
        if (!req.auth.agencyId) {
            return res.status(403).json({ message: 'Agency context required' });
        }
        const parsed = oversightQuerySchema.safeParse({ asOf: req.query.asOf });
        if (!parsed.success) {
            return res
                .status(400)
                .json({ message: 'asOf must be YYYY-MM-DD' });
        }
        const asOf = parsed.data.asOf ?? new Date().toISOString().slice(0, 10);
        const db = req.app.get('db');
        const repo = new ComplianceEngineRepository(db);
        const counts = await repo.getAuthorizationOversight(req.auth.agencyId, asOf);
        res.json({
            agencyId: req.auth.agencyId,
            asOf,
            counts,
            policy: {
                chcQuarterlyReviewDays: PA_RN_SUPERVISION_CHC_DAYS,
            },
        });
    }
    catch (error) {
        safeError('Authorization oversight failed:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
const authorizationListQuerySchema = z.object({
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    filter: z
        .enum(['active', 'expiring-14d', 'expiring-30d', 'expiring-90d', 'recently-expired'])
        .optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional(),
});
/**
 * GET /api/compliance-engine/authorizations/list?asOf=&filter=&limit=&offset=
 *
 * Detail list of authorizations for the agency with computed `unitsUsed`
 * (from `evv_visits` joined through assignment → visit_template → client) and
 * an `urgency` bucket the UI uses to color rows.
 *
 * `filter` defaults to `active`. `limit` clamps to [1, 200]; `offset` clamps
 * to ≥ 0. Capability `client.read` (admin + coordinator) — same as the
 * overview endpoint above.
 */
router.get('/authorizations/list', requireCapability('client.read'), async (req, res) => {
    try {
        if (!req.auth.agencyId) {
            return res.status(403).json({ message: 'Agency context required' });
        }
        const parsed = authorizationListQuerySchema.safeParse({
            asOf: req.query.asOf,
            filter: req.query.filter,
            limit: req.query.limit,
            offset: req.query.offset,
        });
        if (!parsed.success) {
            return res.status(400).json({
                message: 'Invalid query: asOf must be YYYY-MM-DD; filter must be one of active|expiring-14d|expiring-30d|expiring-90d|recently-expired; limit ≤ 200',
            });
        }
        const asOf = parsed.data.asOf ?? new Date().toISOString().slice(0, 10);
        const db = req.app.get('db');
        const repo = new ComplianceEngineRepository(db);
        const page = await repo.listAuthorizations(req.auth.agencyId, {
            asOf,
            filter: parsed.data.filter,
            limit: parsed.data.limit,
            offset: parsed.data.offset,
        });
        res.json({
            agencyId: req.auth.agencyId,
            ...page,
            policy: {
                chcQuarterlyReviewDays: PA_RN_SUPERVISION_CHC_DAYS,
            },
        });
    }
    catch (error) {
        safeError('Authorization list failed:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
/**
 * GET /api/compliance-engine/summary
 *
 * Aggregate headline KPIs across all 7 Compliance Engine modules for the
 * Overview page in one round-trip. Capability `audit.read` (admin-only) since
 * the summary surfaces audit-event counts; coordinators continue to use the
 * per-module routes that match their narrower caps.
 */
router.get('/summary', requireCapability('audit.read'), async (req, res) => {
    try {
        if (!req.auth.agencyId) {
            return res.status(403).json({ message: 'Agency context required' });
        }
        const asOf = new Date().toISOString().slice(0, 10);
        const db = req.app.get('db');
        const repo = new ComplianceEngineRepository(db);
        const counts = await repo.getEngineSummary(req.auth.agencyId, asOf);
        res.json({
            agencyId: req.auth.agencyId,
            asOf,
            counts,
        });
    }
    catch (error) {
        safeError('Compliance Engine summary failed:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
const credentialsQuerySchema = z.object({
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
/**
 * GET /api/compliance-engine/credentials/overview?asOf=YYYY-MM-DD
 *
 * Credentials compliance snapshot — active/pending/expired counts plus
 * expiring-in-30/90-day windows and recently-expired. Surfaces the PA-specific
 * credential taxonomy (`paComplianceCredentials`) in the policy block so the UI
 * can render it without hardcoding. Capability `staff.read` (admin + coordinator).
 */
router.get('/credentials/overview', requireCapability('staff.read'), async (req, res) => {
    try {
        if (!req.auth.agencyId) {
            return res.status(403).json({ message: 'Agency context required' });
        }
        const parsed = credentialsQuerySchema.safeParse({ asOf: req.query.asOf });
        if (!parsed.success) {
            return res.status(400).json({ message: 'asOf must be YYYY-MM-DD' });
        }
        const asOf = parsed.data.asOf ?? new Date().toISOString().slice(0, 10);
        const db = req.app.get('db');
        const repo = new ComplianceEngineRepository(db);
        const counts = await repo.getCredentialsCompliance(req.auth.agencyId, asOf);
        res.json({
            agencyId: req.auth.agencyId,
            asOf,
            counts,
            policy: {
                backgroundCheckRenewalYears: PA_BACKGROUND_CHECK_RENEWAL_YEARS,
                paComplianceCredentials: [...paComplianceCredentials],
            },
        });
    }
    catch (error) {
        safeError('Credentials compliance overview failed:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
/**
 * GET /api/compliance-engine/claims/overview
 *
 * Claim Matching readiness — counts of EVV visits by status (verified =
 * claim-ready, flagged = not-ready, pending = in-flight). Capability `evv.read`
 * (admin + coordinator). Policy block echoes the 7-day Sandata submission window.
 */
router.get('/claims/overview', requireCapability('billing.read'), async (req, res) => {
    try {
        if (!req.auth.agencyId) {
            return res.status(403).json({ message: 'Agency context required' });
        }
        const db = req.app.get('db');
        const repo = new ComplianceEngineRepository(db);
        const counts = await repo.getClaimMatching(req.auth.agencyId);
        res.json({
            agencyId: req.auth.agencyId,
            asOf: new Date().toISOString(),
            counts,
            policy: {
                sandataSubmissionWindowDays: PA_SANDATA_SUBMISSION_WINDOW_DAYS,
            },
        });
    }
    catch (error) {
        safeError('Claim matching overview failed:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
/**
 * GET /api/compliance-engine/claims/blockers
 *
 * The ACTIONABLE list behind the claim-readiness counts: which visits are not
 * billable yet (open / flagged / pending) and why, so an owner can clear them
 * before generating claims. Capability `billing.read` (admin + coordinator).
 */
router.get('/claims/blockers', requireCapability('billing.read'), async (req, res) => {
    try {
        if (!req.auth.agencyId) {
            return res.status(403).json({ message: 'Agency context required' });
        }
        const db = req.app.get('db');
        const repo = new ComplianceEngineRepository(db);
        const result = await repo.getClaimReadinessBlockers(req.auth.agencyId);
        res.json({ asOf: new Date().toISOString(), ...result });
    }
    catch (error) {
        safeError('Claim readiness blockers failed:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
/**
 * GET /api/compliance-engine/payroll/overview
 *
 * Payroll Reconciliation snapshot derived from EVV-verified clock events:
 * verified hours in the trailing 7 / 30 days, completed visits in 7 days,
 * and currently in-progress shifts. Capability `evv.read` (admin + coordinator).
 */
router.get('/payroll/overview', requireCapability('billing.read'), async (req, res) => {
    try {
        if (!req.auth.agencyId) {
            return res.status(403).json({ message: 'Agency context required' });
        }
        const db = req.app.get('db');
        const repo = new ComplianceEngineRepository(db);
        const counts = await repo.getPayrollReconciliation(req.auth.agencyId);
        res.json({
            agencyId: req.auth.agencyId,
            asOf: new Date().toISOString(),
            counts,
            policy: {
                gracePeriodMinutes: PA_GRACE_PERIOD_MINUTES,
            },
        });
    }
    catch (error) {
        safeError('Payroll reconciliation overview failed:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
const medicaidQuerySchema = z.object({
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
/**
 * GET /api/compliance-engine/medicaid/overview?asOf=YYYY-MM-DD
 *
 * Medicaid Workflow snapshot: distinct active MA cases, distinct payers,
 * distinct service codes (service-mix breadth), and authorizations created
 * in the last 30 days. CHC MCO names are surfaced as policy context until
 * MCO tagging lives on the authorizations table.
 * Capability `client.read` (admin + coordinator).
 */
router.get('/medicaid/overview', requireCapability('client.read'), async (req, res) => {
    try {
        if (!req.auth.agencyId) {
            return res.status(403).json({ message: 'Agency context required' });
        }
        const parsed = medicaidQuerySchema.safeParse({ asOf: req.query.asOf });
        if (!parsed.success) {
            return res.status(400).json({ message: 'asOf must be YYYY-MM-DD' });
        }
        const asOf = parsed.data.asOf ?? new Date().toISOString().slice(0, 10);
        const db = req.app.get('db');
        const repo = new ComplianceEngineRepository(db);
        const counts = await repo.getMedicaidWorkflow(req.auth.agencyId, asOf);
        res.json({
            agencyId: req.auth.agencyId,
            asOf,
            counts,
            policy: {
                chcQuarterlyReviewDays: PA_RN_SUPERVISION_CHC_DAYS,
                chcMcos: [
                    'AmeriHealth Caritas Northeast',
                    'Pennsylvania Health & Wellness',
                    'UPMC Community HealthChoices',
                ],
            },
        });
    }
    catch (error) {
        safeError('Medicaid workflow overview failed:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
/**
 * GET /api/compliance-engine/exceptions/overview
 *
 * Unified open-exception count for the agency: total open EVV exceptions plus
 * a breakdown by `exception_type` (late-clock-in / missing-location /
 * manual-entry / telephony-fallback), plus `vmurPending` from visit_maintenance.
 * Capability `evv.read` (admin + coordinator); caregiver has evv.write but
 * not evv.read and is rejected.
 */
router.get('/exceptions/overview', requireCapability('audit.read'), async (req, res) => {
    try {
        if (!req.auth.agencyId) {
            return res.status(403).json({ message: 'Agency context required' });
        }
        const db = req.app.get('db');
        const repo = new ComplianceEngineRepository(db);
        const counts = await repo.getExceptionResolution(req.auth.agencyId);
        res.json({
            agencyId: req.auth.agencyId,
            asOf: new Date().toISOString(),
            counts,
            policy: {
                dhsResponseSlaHours: PA_DHS_AUDIT_RESPONSE_HOURS,
            },
        });
    }
    catch (error) {
        safeError('Exception resolution overview failed:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
const exceptionListQuerySchema = z.object({
    type: z.enum(paExceptionTypes).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional(),
});
/**
 * GET /api/compliance-engine/exceptions/list?type=&limit=&offset=
 *
 * Paginated list of open EVV exceptions (`approved_at IS NULL`) for the agency,
 * joined to the underlying `evv_visits` so each row carries the visit's
 * clock-in time. Coordinators use this to age the queue against the 48-hour
 * PA DHS SLA. Capability `evv.read` (admin + coordinator).
 */
router.get('/exceptions/list', requireCapability('audit.read'), async (req, res) => {
    try {
        if (!req.auth.agencyId) {
            return res.status(403).json({ message: 'Agency context required' });
        }
        const parsed = exceptionListQuerySchema.safeParse({
            type: req.query.type,
            limit: req.query.limit,
            offset: req.query.offset,
        });
        if (!parsed.success) {
            return res.status(400).json({
                message: 'Invalid query: type must be one of late-clock-in|missing-location|telephony-fallback|manual-entry; limit ≤ 200',
            });
        }
        const db = req.app.get('db');
        const repo = new ComplianceEngineRepository(db);
        const page = await repo.listOpenExceptions(req.auth.agencyId, {
            type: parsed.data.type,
            limit: parsed.data.limit,
            offset: parsed.data.offset,
        });
        res.json({
            agencyId: req.auth.agencyId,
            asOf: new Date().toISOString(),
            ...page,
            policy: {
                dhsResponseSlaHours: PA_DHS_AUDIT_RESPONSE_HOURS,
            },
        });
    }
    catch (error) {
        safeError('Exception list failed:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
const exceptionAckBodySchema = z.object({
    note: z.string().min(1).max(2000).optional(),
});
/**
 * POST /api/compliance-engine/exceptions/:id/acknowledge
 *
 * Acknowledge a single open EVV exception. Stamps `approved_by` +
 * `approved_at` inside a single transaction (which also re-checks the
 * agency scope) and emits one `exception.approved` audit event so the
 * regulator-facing audit trail captures the actor, timestamp, and optional
 * note.
 *
 * Idempotent — re-acknowledging an already-closed exception returns 409 with
 * a stable error code so the UI can hide the row without confusing the user.
 *
 * Capability `audit.read` here is intentional: PA's audit-defense workflow
 * treats exception acknowledgement as an audit-level action (the row becomes
 * part of the defense packet), so admins do it but coordinators do not.
 */
router.post('/exceptions/:id/acknowledge', requireCapability('audit.read'), async (req, res) => {
    try {
        if (!req.auth.agencyId) {
            return res.status(403).json({ message: 'Agency context required' });
        }
        const id = z
            .string()
            .uuid()
            .safeParse(req.params.id);
        if (!id.success) {
            return res.status(400).json({ message: 'Exception id must be a UUID' });
        }
        const body = exceptionAckBodySchema.safeParse(req.body ?? {});
        if (!body.success) {
            return res.status(400).json({ message: 'Invalid note (max 2000 chars)' });
        }
        const db = req.app.get('db');
        const repo = new ComplianceEngineRepository(db);
        const result = await repo.acknowledgeException(req.auth.agencyId, id.data, req.auth.userId);
        if (!result) {
            return res
                .status(409)
                .json({ code: 'not_found_or_already_acknowledged' });
        }
        try {
            await new AuditEventRepository(db).create({
                agencyId: req.auth.agencyId,
                actorId: req.auth.userId,
                actorType: 'user',
                eventType: 'exception.approved',
                entityType: 'evv_exception',
                entityId: result.id,
                outcome: 'success',
                payload: {
                    exceptionType: result.exceptionType,
                    visitId: result.visitId,
                    note: body.data.note ?? null,
                },
            });
        }
        catch (auditErr) {
            process.stderr.write(`[audit-write-failed] exception.approved exception=${result.id} ` +
                `error=${auditErr instanceof Error ? auditErr.message : String(auditErr)}\n`);
        }
        res.status(200).json({
            exception: result,
            acknowledgedBy: req.auth.userId,
        });
    }
    catch (error) {
        safeError('Exception acknowledge failed:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
export default router;
//# sourceMappingURL=compliance-engine-routes.js.map