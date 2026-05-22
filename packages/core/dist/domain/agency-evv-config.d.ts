/**
 * Per-agency EVV aggregator configuration.
 *
 * This is the "which aggregator does this agency use" record. Per-aggregator
 * detail (mappings, provider IDs) lives in `agency_sandata_config` and the
 * forthcoming `agency_hhaexchange_config`.
 *
 * The shape is small on purpose — it's the answer to a single product
 * question ("which aggregator should the export pipeline route to for this
 * agency"), separated from the details needed once that question is settled.
 */
import { z } from 'zod';
export declare const evvAggregatorSchema: z.ZodEnum<{
    hhaexchange: "hhaexchange";
    sandata: "sandata";
    none: "none";
}>;
export type EvvAggregatorValue = z.infer<typeof evvAggregatorSchema>;
export declare const agencyEvvConfigSchema: z.ZodObject<{
    agencyId: z.ZodString;
    aggregator: z.ZodEnum<{
        hhaexchange: "hhaexchange";
        sandata: "sandata";
        none: "none";
    }>;
    stateCode: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    productionReady: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type AgencyEvvConfig = z.infer<typeof agencyEvvConfigSchema>;
/**
 * Update payload sent by the admin UI. `productionReady` is optional — most
 * picker interactions just change the aggregator and shouldn't accidentally
 * flip the go-live switch.
 */
export declare const agencyEvvConfigUpdateSchema: z.ZodObject<{
    aggregator: z.ZodEnum<{
        hhaexchange: "hhaexchange";
        sandata: "sandata";
        none: "none";
    }>;
    productionReady: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type AgencyEvvConfigUpdate = z.infer<typeof agencyEvvConfigUpdateSchema>;
//# sourceMappingURL=agency-evv-config.d.ts.map