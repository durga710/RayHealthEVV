import { Router } from 'express';
import { EvvRepository } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';
const router = Router();
/** Escape one CSV cell per RFC 4180. */
function csvCell(value) {
    if (value == null)
        return '';
    const s = String(value);
    if (/[",\r\n]/.test(s))
        return `"${s.replace(/"/g, '""')}"`;
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
router.get('/visits.csv', requireCapability('schedule.read'), async (req, res) => {
    try {
        const fromRaw = typeof req.query.from === 'string' ? req.query.from : undefined;
        const toRaw = typeof req.query.to === 'string' ? req.query.to : undefined;
        const isDate = (v) => !v || /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v);
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
        const lines = [header.join(',')];
        for (const row of rows) {
            const loc = (row.clockInLocation ?? {});
            lines.push([
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
                .join(','));
        }
        const body = lines.join('\n') + '\n';
        const filename = `rayhealth-visits-${req.auth.agencyId.slice(0, 8)}-${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;
        res.setHeader('content-type', 'text/csv; charset=utf-8');
        res.setHeader('content-disposition', `attachment; filename="${filename}"`);
        res.send(body);
    }
    catch (err) {
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
router.get('/sandata.csv', requireCapability('schedule.read'), async (req, res) => {
    try {
        const fromRaw = typeof req.query.from === 'string' ? req.query.from : undefined;
        const toRaw = typeof req.query.to === 'string' ? req.query.to : undefined;
        const isDate = (v) => !v || /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v);
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
            .select('v.id as visit_id', 'cg.id as worker_id', 'cg.first_name as worker_first_name', 'cg.last_name as worker_last_name', 'c.id as client_id', 'c.first_name as client_first_name', 'c.last_name as client_last_name', 'v.service_code', 'a.scheduled_start_time', 'a.scheduled_end_time', 'v.clock_in_time', 'v.clock_out_time', 'v.clock_in_location', 'v.clock_out_location', 'v.status')
            .orderBy('v.clock_in_time', 'asc');
        if (fromIso)
            q = q.andWhere('v.clock_in_time', '>=', fromIso);
        if (toIso)
            q = q.andWhere('v.clock_in_time', '<=', toIso);
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
        const toIsoTime = (v) => {
            if (!v)
                return '';
            const d = v instanceof Date ? v : new Date(String(v));
            const hh = String(d.getUTCHours()).padStart(2, '0');
            const mm = String(d.getUTCMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
        };
        const toIsoDate = (v) => {
            if (!v)
                return '';
            const d = v instanceof Date ? v : new Date(String(v));
            return d.toISOString().slice(0, 10);
        };
        const parseLoc = (loc) => {
            if (!loc)
                return {};
            const obj = typeof loc === 'string' ? JSON.parse(loc) : loc;
            return { lat: obj.lat, lng: obj.lng };
        };
        const lines = [header.join(',')];
        for (const row of rows) {
            const startLoc = parseLoc(row.clock_in_location);
            const endLoc = parseLoc(row.clock_out_location);
            // Sandata expects a verification-method code — GPS for our
            // geofence path, PHONE for the telephony fallback. We don't
            // currently persist that; default to GPS when coords exist,
            // BLANK otherwise. Production must derive from a stored
            // verification_method column.
            const startVerif = startLoc.lat ? 'GPS' : '';
            const endVerif = endLoc.lat ? 'GPS' : '';
            lines.push([
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
                .join(','));
        }
        const body = lines.join('\n') + '\n';
        const filename = `rayhealth-sandata-${req.auth.agencyId.slice(0, 8)}-${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;
        res.setHeader('content-type', 'text/csv; charset=utf-8');
        res.setHeader('content-disposition', `attachment; filename="${filename}"`);
        res.send(body);
    }
    catch (err) {
        safeError('sandata.csv export failed', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
export default router;
//# sourceMappingURL=export-routes.js.map