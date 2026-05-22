/**
 * Repository for the `agency_evv_config` table.
 *
 * Single row per agency. `findOrInitialize` is the typical entry point —
 * returns a stored row if one exists, otherwise synthesizes a default that
 * matches the state registry's defaults (without persisting). Callers that
 * want to persist must call `upsert`.
 */

import type { Knex } from 'knex'
import { resolveAggregator, getStateConfig } from '../config/states/index.js'
import type { AgencyEvvConfig, EvvAggregatorValue } from '../domain/agency-evv-config.js'

interface AgencyEvvConfigRow {
  agency_id: string
  aggregator: string
  state_code: string
  production_ready: boolean
  created_at?: Date | string
  updated_at?: Date | string
}

function rowToConfig(row: AgencyEvvConfigRow): AgencyEvvConfig {
  return {
    agencyId: row.agency_id,
    aggregator: (row.aggregator as EvvAggregatorValue) ?? 'none',
    stateCode: row.state_code.toUpperCase(),
    productionReady: Boolean(row.production_ready),
  }
}

export class AgencyEvvConfigRepository {
  constructor(private readonly db: Knex) {}

  async findByAgency(agencyId: string): Promise<AgencyEvvConfig | undefined> {
    const row = (await this.db('agency_evv_config').where({ agency_id: agencyId }).first()) as
      | AgencyEvvConfigRow
      | undefined
    return row ? rowToConfig(row) : undefined
  }

  /**
   * Look up the config, or compute a sensible default from the agency's
   * state. Does NOT persist — the caller decides whether to write back.
   */
  async findOrInitialize(agencyId: string, stateCode: string): Promise<AgencyEvvConfig> {
    const existing = await this.findByAgency(agencyId)
    if (existing) return existing
    const normalizedState = stateCode.toUpperCase()
    const stateConfig = getStateConfig(normalizedState)
    return {
      agencyId,
      aggregator: stateConfig?.defaultAggregator ?? 'none',
      stateCode: normalizedState,
      productionReady: false,
    }
  }

  async upsert(input: AgencyEvvConfig): Promise<AgencyEvvConfig> {
    const payload = {
      agency_id: input.agencyId,
      aggregator: input.aggregator,
      state_code: input.stateCode.toUpperCase(),
      production_ready: input.productionReady,
      updated_at: this.db.fn.now(),
    }
    await this.db('agency_evv_config')
      .insert({ ...payload, created_at: this.db.fn.now() })
      .onConflict('agency_id')
      .merge({
        aggregator: payload.aggregator,
        state_code: payload.state_code,
        production_ready: payload.production_ready,
        updated_at: payload.updated_at,
      })

    const stored = await this.findByAgency(input.agencyId)
    if (!stored) throw new Error(`upsert succeeded but no row found for agency=${input.agencyId}`)
    return stored
  }

  /**
   * Resolves the effective aggregator for an agency, respecting the state's
   * `aggregatorChoice` flag. States that don't allow choice (e.g. NJ) ignore
   * the persisted preference and always return the state default.
   */
  async resolve(agencyId: string, stateCode: string): Promise<EvvAggregatorValue> {
    const config = await this.findByAgency(agencyId)
    return resolveAggregator(
      stateCode,
      config?.aggregator === 'none' ? undefined : (config?.aggregator as 'sandata' | 'hhaexchange' | undefined),
    )
  }
}
