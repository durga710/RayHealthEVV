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

import { z } from 'zod'

export const evvAggregatorSchema = z.enum(['sandata', 'hhaexchange', 'none'])
export type EvvAggregatorValue = z.infer<typeof evvAggregatorSchema>

export const agencyEvvConfigSchema = z.object({
  agencyId: z.string().uuid(),
  aggregator: evvAggregatorSchema,
  stateCode: z
    .string()
    .length(2)
    .transform((s) => s.toUpperCase()),
  productionReady: z.boolean().default(false),
})

export type AgencyEvvConfig = z.infer<typeof agencyEvvConfigSchema>

/**
 * Update payload sent by the admin UI. `productionReady` is optional — most
 * picker interactions just change the aggregator and shouldn't accidentally
 * flip the go-live switch.
 */
export const agencyEvvConfigUpdateSchema = z.object({
  aggregator: evvAggregatorSchema,
  productionReady: z.boolean().optional(),
})

export type AgencyEvvConfigUpdate = z.infer<typeof agencyEvvConfigUpdateSchema>
