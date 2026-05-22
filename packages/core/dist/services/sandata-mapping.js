/**
 * Sandata aggregator mapping — config schema + lookup.
 *
 * The Sandata EVV Provider Self-Service Visit Maintenance CSV requires three
 * pieces of identity that we cannot derive from RayHealth's internal IDs alone:
 *
 *   1. Sandata Provider ID   — assigned to the agency by Sandata once they
 *                              register with the PA Aggregator. Format: 9-digit
 *                              numeric string.
 *   2. External Worker ID    — Sandata's caregiver-stable ID. Often equals the
 *                              caregiver's SSN-last-4 + state license + birth
 *                              year, but each agency configures their own scheme.
 *   3. Service code + HCPCS  — Sandata expects an HCPCS service code + modifier
 *                              combination per visit. PA most commonly uses:
 *                                T1019 U4 → personal care services
 *                                T1019 U5 → respite
 *                                T1019 U7 → companion / homemaker
 *
 * This module:
 *   - Defines the per-agency config shape and validates it with Zod
 *   - Provides a single `buildSandataRow()` function that converts a visit +
 *     caregiver + client + config into a typed Sandata row
 *   - Refuses to emit a row when any required mapping is missing — never
 *     ships a partial CSV that Sandata would reject silently
 *
 * Persistence: stored in a new table `agency_sandata_config` (one row per
 * agency). See migration `2026-05-11-add-agency-sandata-config.ts`.
 */
import { z } from 'zod';
// ---------- Config schema ----------
const HCPCS_MODIFIERS = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9'];
export const sandataServiceMappingSchema = z.object({
    /** RayHealth service code as used in the visit_templates.tasks JSON. */
    internalServiceCode: z.string().min(1),
    /** HCPCS base code, e.g. "T1019". */
    hcpcsCode: z.string().regex(/^[A-Z]\d{4}$/, 'HCPCS must be 5 characters: 1 letter + 4 digits'),
    /** HCPCS modifier — Sandata requires one for PA personal care. */
    hcpcsModifier: z.enum(HCPCS_MODIFIERS),
    /** Human-readable label for audit/exception messages. */
    label: z.string().min(1),
});
export const sandataCaregiverMappingSchema = z.object({
    /** RayHealth caregiver UUID. */
    caregiverId: z.string().uuid(),
    /** Sandata external worker ID — opaque string assigned by the agency. */
    externalWorkerId: z.string().min(1).max(32),
});
export const sandataConfigSchema = z.object({
    agencyId: z.string().uuid(),
    /** Sandata Provider ID — assigned by Sandata when the agency registers. */
    providerId: z.string().regex(/^\d{9}$/, 'Sandata Provider ID is 9 digits'),
    /** ISO 8601 timezone identifier; visit timestamps are emitted in this zone. */
    timezone: z.string().default('America/New_York'),
    /** Per-caregiver external worker mapping. Caregivers without a mapping are skipped. */
    caregivers: z.array(sandataCaregiverMappingSchema),
    /** Per-service-code HCPCS mapping. Visits with unmapped service codes are skipped. */
    services: z.array(sandataServiceMappingSchema),
    /** When false, the export endpoint returns an empty CSV — used for staged rollout. */
    enabled: z.boolean().default(false),
});
export const SANDATA_CSV_COLUMNS = [
    'ProviderID',
    'ExternalWorkerID',
    'ClientMedicaidID',
    'ClientFirstName',
    'ClientLastName',
    'VisitStart',
    'VisitEnd',
    'ServiceCode',
    'Modifier',
    'ClockInLat',
    'ClockInLng',
    'ClockOutLat',
    'ClockOutLng',
];
function buildLookups(config) {
    return {
        caregiverIdToExternalWorkerId: new Map(config.caregivers.map((c) => [c.caregiverId, c.externalWorkerId])),
        serviceCodeToHcpcs: new Map(config.services.map((s) => [
            s.internalServiceCode,
            { hcpcsCode: s.hcpcsCode, hcpcsModifier: s.hcpcsModifier },
        ])),
    };
}
/**
 * Convert a single visit into a Sandata CSV row, or describe why it was skipped.
 * Pure function — no I/O. Callers iterate over visits and collect the outcomes.
 */
export function buildSandataRow(visit, config, lookups) {
    if (!config.enabled) {
        return { ok: false, reason: 'config_disabled', visitId: visit.visitId };
    }
    if (!visit.clientMedicaidId) {
        return { ok: false, reason: 'missing_medicaid_id', visitId: visit.visitId };
    }
    if (!visit.clockOutIso) {
        return {
            ok: false,
            reason: 'clock_out_required',
            visitId: visit.visitId,
            details: 'Sandata requires a completed visit (clock-out) before transmission.',
        };
    }
    const resolved = lookups ?? buildLookups(config);
    const externalWorkerId = resolved.caregiverIdToExternalWorkerId.get(visit.caregiverId);
    if (!externalWorkerId) {
        return {
            ok: false,
            reason: 'no_caregiver_mapping',
            visitId: visit.visitId,
            details: `Caregiver ${visit.caregiverId} has no Sandata external worker mapping configured.`,
        };
    }
    const hcpcs = resolved.serviceCodeToHcpcs.get(visit.internalServiceCode);
    if (!hcpcs) {
        return {
            ok: false,
            reason: 'no_service_mapping',
            visitId: visit.visitId,
            details: `Service "${visit.internalServiceCode}" has no HCPCS mapping configured.`,
        };
    }
    return {
        ok: true,
        row: {
            ProviderID: config.providerId,
            ExternalWorkerID: externalWorkerId,
            ClientMedicaidID: visit.clientMedicaidId,
            ClientFirstName: visit.clientFirstName,
            ClientLastName: visit.clientLastName,
            VisitStart: visit.clockInIso,
            VisitEnd: visit.clockOutIso,
            ServiceCode: hcpcs.hcpcsCode,
            Modifier: hcpcs.hcpcsModifier,
            ClockInLat: visit.clockInLat.toFixed(6),
            ClockInLng: visit.clockInLng.toFixed(6),
            ClockOutLat: visit.clockOutLat?.toFixed(6) ?? '',
            ClockOutLng: visit.clockOutLng?.toFixed(6) ?? '',
        },
    };
}
/**
 * Bulk-convert a list of visits into Sandata rows + structured skip log.
 * Builds the lookups once and reuses them — efficient for full-month exports.
 */
export function buildSandataExport(visits, config) {
    const lookups = buildLookups(config);
    const rows = [];
    const skipped = [];
    for (const visit of visits) {
        const outcome = buildSandataRow(visit, config, lookups);
        if (outcome.ok) {
            rows.push(outcome.row);
        }
        else {
            skipped.push(outcome);
        }
    }
    return { rows, skipped };
}
/**
 * CSV stringification helper. Quotes fields containing commas or quotes;
 * doubles internal quotes per RFC 4180.
 */
export function toSandataCsv(rows) {
    const header = SANDATA_CSV_COLUMNS.join(',');
    const lines = rows.map((row) => SANDATA_CSV_COLUMNS.map((col) => quoteField(row[col])).join(','));
    return [header, ...lines].join('\n') + '\n';
}
function quoteField(value) {
    if (value === '')
        return '';
    if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
// ---------- Common PA service-code presets ----------
// Agencies can start from this and edit. Pennsylvania DHS PA Aggregator
// most commonly uses these combinations; verify against your most recent
// PA DHS HCPCS modifier guidance before going live.
export const PA_DEFAULT_SERVICE_MAPPINGS = [
    {
        internalServiceCode: 'personal-care',
        hcpcsCode: 'T1019',
        hcpcsModifier: 'U4',
        label: 'Personal Care Services (PCS)',
    },
    {
        internalServiceCode: 'respite',
        hcpcsCode: 'T1019',
        hcpcsModifier: 'U5',
        label: 'Respite Care',
    },
    {
        internalServiceCode: 'companion',
        hcpcsCode: 'T1019',
        hcpcsModifier: 'U7',
        label: 'Companion / Homemaker Services',
    },
];
//# sourceMappingURL=sandata-mapping.js.map