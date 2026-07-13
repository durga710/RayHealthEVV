/**
 * HHAeXchange aggregator mapping — config schema + lookup.
 *
 * Parallel to sandata-mapping.ts. HHAeXchange is the second of two EVV
 * aggregators contracted by PA DHS (and the sole aggregator for NJ).
 * Different column set, different identity scheme:
 *
 *   Sandata:        ProviderID + ExternalWorkerID + Medicaid + HCPCS+Modifier
 *   HHAeXchange:    AgencyTaxID + EmployeeID + MemberID + ServiceCode (own)
 *
 * The agency-level setting picks which aggregator the export pipeline
 * routes to. States with aggregatorChoice=false (e.g. NJ) force HHAeXchange.
 *
 * IMPORTANT: this is a RayHealth mapping preview, not the Pennsylvania
 * HHAeXchange Homecare V5 Flat File. PA's official import layout extends
 * through column CR and needs payer-specific code tables issued during vendor
 * onboarding. Never transmit this compact preview as a production V5 file.
 */
import { z } from 'zod';
// ---------- Config schema ----------
export const hhaexchangeServiceMappingSchema = z.object({
    /** RayHealth internal service code referenced in visit_template.tasks. */
    internalServiceCode: z.string().min(1),
    /** HHAeXchange numeric service code assigned per state Medicaid program. */
    hhaServiceCode: z.string().min(1).max(16),
    /** Human-readable label. */
    label: z.string().min(1),
});
export const hhaexchangeCaregiverMappingSchema = z.object({
    caregiverId: z.string().uuid(),
    /** HHAeXchange "Employee ID" — opaque per-agency identifier. */
    employeeId: z.string().min(1).max(32),
});
export const hhaexchangeConfigSchema = z.object({
    agencyId: z.string().uuid(),
    /** Tax ID (EIN, 9 digits, no dash) registered with HHAeXchange. */
    agencyTaxId: z.string().regex(/^\d{9}$/, 'HHAeXchange agency tax ID is 9 digits, no dash'),
    /** HHAeXchange's per-agency provider identifier. */
    hhaProviderId: z.string().min(1).max(32),
    timezone: z.string().default('America/New_York'),
    caregivers: z.array(hhaexchangeCaregiverMappingSchema),
    services: z.array(hhaexchangeServiceMappingSchema),
    enabled: z.boolean().default(false),
});
export const HHAEXCHANGE_CSV_COLUMNS = [
    'AgencyTaxID',
    'ProviderID',
    'EmployeeID',
    'MemberID',
    'MemberFirstName',
    'MemberLastName',
    'ServiceStart',
    'ServiceEnd',
    'ServiceCode',
    'ClockInLat',
    'ClockInLng',
    'ClockOutLat',
    'ClockOutLng',
];
function buildLookups(config) {
    return {
        caregiverIdToEmployeeId: new Map(config.caregivers.map((c) => [c.caregiverId, c.employeeId])),
        serviceCodeToHha: new Map(config.services.map((s) => [s.internalServiceCode, { hhaServiceCode: s.hhaServiceCode }])),
    };
}
export function buildHhaexchangeRow(visit, config, lookups) {
    if (!config.enabled) {
        return { ok: false, reason: 'config_disabled', visitId: visit.visitId };
    }
    if (!visit.memberId) {
        return { ok: false, reason: 'missing_member_id', visitId: visit.visitId };
    }
    if (!visit.clockOutIso) {
        return { ok: false, reason: 'clock_out_required', visitId: visit.visitId };
    }
    const resolved = lookups ?? buildLookups(config);
    const employeeId = resolved.caregiverIdToEmployeeId.get(visit.caregiverId);
    if (!employeeId) {
        return {
            ok: false,
            reason: 'no_caregiver_mapping',
            visitId: visit.visitId,
            details: `Caregiver ${visit.caregiverId} has no HHAeXchange employee mapping.`,
        };
    }
    const svc = resolved.serviceCodeToHha.get(visit.internalServiceCode);
    if (!svc) {
        return {
            ok: false,
            reason: 'no_service_mapping',
            visitId: visit.visitId,
            details: `Service "${visit.internalServiceCode}" has no HHAeXchange code mapping.`,
        };
    }
    return {
        ok: true,
        row: {
            AgencyTaxID: config.agencyTaxId,
            ProviderID: config.hhaProviderId,
            EmployeeID: employeeId,
            MemberID: visit.memberId,
            MemberFirstName: visit.clientFirstName,
            MemberLastName: visit.clientLastName,
            ServiceStart: visit.clockInIso,
            ServiceEnd: visit.clockOutIso,
            ServiceCode: svc.hhaServiceCode,
            ClockInLat: visit.clockInLat.toFixed(6),
            ClockInLng: visit.clockInLng.toFixed(6),
            ClockOutLat: visit.clockOutLat?.toFixed(6) ?? '',
            ClockOutLng: visit.clockOutLng?.toFixed(6) ?? '',
        },
    };
}
export function buildHhaexchangeExport(visits, config) {
    const lookups = buildLookups(config);
    const rows = [];
    const skipped = [];
    for (const v of visits) {
        const r = buildHhaexchangeRow(v, config, lookups);
        if (r.ok)
            rows.push(r.row);
        else
            skipped.push(r);
    }
    return { rows, skipped };
}
export function toHhaexchangeCsv(rows) {
    const header = HHAEXCHANGE_CSV_COLUMNS.join(',');
    const lines = rows.map((row) => HHAEXCHANGE_CSV_COLUMNS.map((col) => quoteField(row[col])).join(','));
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
//# sourceMappingURL=hhaexchange-mapping.js.map