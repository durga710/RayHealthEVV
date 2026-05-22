/**
 * Repository for the `agency_sandata_config` table.
 *
 * Parallel in shape to `AgencyHhaexchangeConfigRepository`. Stores per-agency
 * Sandata Provider ID and JSONB mappings for caregivers + services. The
 * `findValid()` overload returns the strongly-typed `SandataConfig` only when
 * the provider_id is populated; `findByAgency()` returns the partial row
 * (nullable identity) so the admin UI can render a half-filled state.
 */

import type { Knex } from 'knex'
import {
  sandataCaregiverMappingSchema,
  sandataServiceMappingSchema,
  type SandataCaregiverMapping,
  type SandataConfig,
  type SandataServiceMapping,
} from '../services/sandata-mapping.js'

interface AgencySandataConfigRow {
  agency_id: string
  provider_id: string | null
  timezone: string
  caregiver_mappings: unknown
  service_mappings: unknown
  enabled: boolean
  created_at?: Date | string
  updated_at?: Date | string
}

function parseJsonField(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function parseCaregivers(value: unknown): SandataCaregiverMapping[] {
  const raw = parseJsonField(value)
  const out: SandataCaregiverMapping[] = []
  for (const item of raw) {
    const parsed = sandataCaregiverMappingSchema.safeParse(item)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

function parseServices(value: unknown): SandataServiceMapping[] {
  const raw = parseJsonField(value)
  const out: SandataServiceMapping[] = []
  for (const item of raw) {
    const parsed = sandataServiceMappingSchema.safeParse(item)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

export interface PartialSandataConfig {
  agencyId: string
  providerId: string | null
  timezone: string
  caregivers: SandataCaregiverMapping[]
  services: SandataServiceMapping[]
  enabled: boolean
}

function rowToPartial(row: AgencySandataConfigRow): PartialSandataConfig {
  return {
    agencyId: row.agency_id,
    providerId: row.provider_id,
    timezone: row.timezone || 'America/New_York',
    caregivers: parseCaregivers(row.caregiver_mappings),
    services: parseServices(row.service_mappings),
    enabled: Boolean(row.enabled),
  }
}

function rowToConfig(row: AgencySandataConfigRow): SandataConfig | undefined {
  // SandataConfig requires a provider_id; without it the export pipeline
  // can't emit anything sandata would accept.
  if (!row.provider_id) return undefined
  return {
    agencyId: row.agency_id,
    providerId: row.provider_id,
    timezone: row.timezone || 'America/New_York',
    caregivers: parseCaregivers(row.caregiver_mappings),
    services: parseServices(row.service_mappings),
    enabled: Boolean(row.enabled),
  }
}

export class AgencySandataConfigRepository {
  constructor(private readonly db: Knex) {}

  async findByAgency(agencyId: string): Promise<PartialSandataConfig | undefined> {
    const row = (await this.db('agency_sandata_config')
      .where({ agency_id: agencyId })
      .first()) as AgencySandataConfigRow | undefined
    return row ? rowToPartial(row) : undefined
  }

  async findValid(agencyId: string): Promise<SandataConfig | undefined> {
    const row = (await this.db('agency_sandata_config')
      .where({ agency_id: agencyId })
      .first()) as AgencySandataConfigRow | undefined
    return row ? rowToConfig(row) : undefined
  }

  async upsert(input: PartialSandataConfig): Promise<PartialSandataConfig> {
    const payload = {
      agency_id: input.agencyId,
      provider_id: input.providerId,
      timezone: input.timezone || 'America/New_York',
      caregiver_mappings: JSON.stringify(input.caregivers ?? []),
      service_mappings: JSON.stringify(input.services ?? []),
      enabled: input.enabled,
      updated_at: this.db.fn.now(),
    }
    await this.db('agency_sandata_config')
      .insert({ ...payload, created_at: this.db.fn.now() })
      .onConflict('agency_id')
      .merge({
        provider_id: payload.provider_id,
        timezone: payload.timezone,
        caregiver_mappings: payload.caregiver_mappings,
        service_mappings: payload.service_mappings,
        enabled: payload.enabled,
        updated_at: payload.updated_at,
      })

    const stored = await this.findByAgency(input.agencyId)
    if (!stored) {
      throw new Error(`upsert succeeded but no row found for agency=${input.agencyId}`)
    }
    return stored
  }
}
