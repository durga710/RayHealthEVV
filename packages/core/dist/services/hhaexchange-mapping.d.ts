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
export declare const hhaexchangeServiceMappingSchema: z.ZodObject<{
    internalServiceCode: z.ZodString;
    hhaServiceCode: z.ZodString;
    label: z.ZodString;
}, z.core.$strip>;
export type HhaexchangeServiceMapping = z.infer<typeof hhaexchangeServiceMappingSchema>;
export declare const hhaexchangeCaregiverMappingSchema: z.ZodObject<{
    caregiverId: z.ZodString;
    employeeId: z.ZodString;
}, z.core.$strip>;
export type HhaexchangeCaregiverMapping = z.infer<typeof hhaexchangeCaregiverMappingSchema>;
export declare const hhaexchangeConfigSchema: z.ZodObject<{
    agencyId: z.ZodString;
    agencyTaxId: z.ZodString;
    hhaProviderId: z.ZodString;
    timezone: z.ZodDefault<z.ZodString>;
    caregivers: z.ZodArray<z.ZodObject<{
        caregiverId: z.ZodString;
        employeeId: z.ZodString;
    }, z.core.$strip>>;
    services: z.ZodArray<z.ZodObject<{
        internalServiceCode: z.ZodString;
        hhaServiceCode: z.ZodString;
        label: z.ZodString;
    }, z.core.$strip>>;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type HhaexchangeConfig = z.infer<typeof hhaexchangeConfigSchema>;
export interface HhaexchangeVisitInput {
    visitId: string;
    caregiverId: string;
    /** Client's HHAeXchange "Member ID" — distinct from Medicaid number. */
    memberId: string;
    clientFirstName: string;
    clientLastName: string;
    clockInIso: string;
    clockOutIso: string | null;
    internalServiceCode: string;
    clockInLat: number;
    clockInLng: number;
    clockOutLat: number | null;
    clockOutLng: number | null;
}
export interface HhaexchangeCsvRow {
    AgencyTaxID: string;
    ProviderID: string;
    EmployeeID: string;
    MemberID: string;
    MemberFirstName: string;
    MemberLastName: string;
    ServiceStart: string;
    ServiceEnd: string;
    ServiceCode: string;
    ClockInLat: string;
    ClockInLng: string;
    ClockOutLat: string;
    ClockOutLng: string;
}
export declare const HHAEXCHANGE_CSV_COLUMNS: readonly (keyof HhaexchangeCsvRow)[];
export type HhaexchangeSkipReason = 'no_caregiver_mapping' | 'no_service_mapping' | 'missing_member_id' | 'config_disabled' | 'clock_out_required';
export interface HhaexchangeBuildResult {
    ok: true;
    row: HhaexchangeCsvRow;
}
export interface HhaexchangeSkipResult {
    ok: false;
    reason: HhaexchangeSkipReason;
    visitId: string;
    details?: string;
}
export type HhaexchangeRowOutcome = HhaexchangeBuildResult | HhaexchangeSkipResult;
interface MappingLookups {
    caregiverIdToEmployeeId: Map<string, string>;
    serviceCodeToHha: Map<string, {
        hhaServiceCode: string;
    }>;
}
export declare function buildHhaexchangeRow(visit: HhaexchangeVisitInput, config: HhaexchangeConfig, lookups?: MappingLookups): HhaexchangeRowOutcome;
export declare function buildHhaexchangeExport(visits: readonly HhaexchangeVisitInput[], config: HhaexchangeConfig): {
    rows: HhaexchangeCsvRow[];
    skipped: HhaexchangeSkipResult[];
};
export declare function toHhaexchangeCsv(rows: readonly HhaexchangeCsvRow[]): string;
export {};
//# sourceMappingURL=hhaexchange-mapping.d.ts.map