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
declare const HCPCS_MODIFIERS: readonly ["U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8", "U9"];
type HcpcsModifier = (typeof HCPCS_MODIFIERS)[number];
export declare const sandataServiceMappingSchema: z.ZodObject<{
    internalServiceCode: z.ZodString;
    hcpcsCode: z.ZodString;
    hcpcsModifier: z.ZodEnum<{
        U1: "U1";
        U2: "U2";
        U3: "U3";
        U4: "U4";
        U5: "U5";
        U6: "U6";
        U7: "U7";
        U8: "U8";
        U9: "U9";
    }>;
    label: z.ZodString;
}, z.core.$strip>;
export type SandataServiceMapping = z.infer<typeof sandataServiceMappingSchema>;
export declare const sandataCaregiverMappingSchema: z.ZodObject<{
    caregiverId: z.ZodString;
    externalWorkerId: z.ZodString;
}, z.core.$strip>;
export type SandataCaregiverMapping = z.infer<typeof sandataCaregiverMappingSchema>;
export declare const sandataConfigSchema: z.ZodObject<{
    agencyId: z.ZodString;
    providerId: z.ZodString;
    timezone: z.ZodDefault<z.ZodString>;
    caregivers: z.ZodArray<z.ZodObject<{
        caregiverId: z.ZodString;
        externalWorkerId: z.ZodString;
    }, z.core.$strip>>;
    services: z.ZodArray<z.ZodObject<{
        internalServiceCode: z.ZodString;
        hcpcsCode: z.ZodString;
        hcpcsModifier: z.ZodEnum<{
            U1: "U1";
            U2: "U2";
            U3: "U3";
            U4: "U4";
            U5: "U5";
            U6: "U6";
            U7: "U7";
            U8: "U8";
            U9: "U9";
        }>;
        label: z.ZodString;
    }, z.core.$strip>>;
    enabled: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type SandataConfig = z.infer<typeof sandataConfigSchema>;
export interface SandataVisitInput {
    visitId: string;
    caregiverId: string;
    clientMedicaidId: string;
    clientFirstName: string;
    clientLastName: string;
    clockInIso: string;
    clockOutIso: string | null;
    /** Service code referenced in the visit_template.tasks JSON. */
    internalServiceCode: string;
    /** Geofence verification — Sandata records lat/lng of clock-in. */
    clockInLat: number;
    clockInLng: number;
    clockOutLat: number | null;
    clockOutLng: number | null;
}
export interface SandataCsvRow {
    /** Sandata column 1: provider ID. */
    ProviderID: string;
    /** Sandata column 2: external worker (caregiver) ID. */
    ExternalWorkerID: string;
    /** Sandata column 3: client Medicaid ID. */
    ClientMedicaidID: string;
    /** Sandata column 4: client first name. */
    ClientFirstName: string;
    /** Sandata column 5: client last name. */
    ClientLastName: string;
    /** Sandata column 6: visit start ISO 8601 in configured timezone. */
    VisitStart: string;
    /** Sandata column 7: visit end ISO 8601 in configured timezone (or empty if still open). */
    VisitEnd: string;
    /** Sandata column 8: HCPCS service code, e.g. T1019. */
    ServiceCode: string;
    /** Sandata column 9: HCPCS modifier, e.g. U4. */
    Modifier: string;
    /** Sandata column 10: clock-in lat. */
    ClockInLat: string;
    /** Sandata column 11: clock-in lng. */
    ClockInLng: string;
    /** Sandata column 12: clock-out lat (or empty). */
    ClockOutLat: string;
    /** Sandata column 13: clock-out lng (or empty). */
    ClockOutLng: string;
}
export declare const SANDATA_CSV_COLUMNS: readonly (keyof SandataCsvRow)[];
export type SandataSkipReason = 'no_caregiver_mapping' | 'no_service_mapping' | 'missing_medicaid_id' | 'config_disabled' | 'clock_out_required';
export interface SandataBuildResult {
    ok: true;
    row: SandataCsvRow;
}
export interface SandataSkipResult {
    ok: false;
    reason: SandataSkipReason;
    visitId: string;
    details?: string;
}
export type SandataRowOutcome = SandataBuildResult | SandataSkipResult;
interface MappingLookups {
    caregiverIdToExternalWorkerId: Map<string, string>;
    serviceCodeToHcpcs: Map<string, {
        hcpcsCode: string;
        hcpcsModifier: HcpcsModifier;
    }>;
}
/**
 * Convert a single visit into a Sandata CSV row, or describe why it was skipped.
 * Pure function — no I/O. Callers iterate over visits and collect the outcomes.
 */
export declare function buildSandataRow(visit: SandataVisitInput, config: SandataConfig, lookups?: MappingLookups): SandataRowOutcome;
/**
 * Bulk-convert a list of visits into Sandata rows + structured skip log.
 * Builds the lookups once and reuses them — efficient for full-month exports.
 */
export declare function buildSandataExport(visits: readonly SandataVisitInput[], config: SandataConfig): {
    rows: SandataCsvRow[];
    skipped: SandataSkipResult[];
};
/**
 * CSV stringification helper. Quotes fields containing commas or quotes;
 * doubles internal quotes per RFC 4180.
 */
export declare function toSandataCsv(rows: readonly SandataCsvRow[]): string;
export declare const PA_DEFAULT_SERVICE_MAPPINGS: SandataServiceMapping[];
export {};
//# sourceMappingURL=sandata-mapping.d.ts.map