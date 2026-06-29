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
import { encryptCell, decryptCell } from '../security/cell-cipher.js'
import type { IntegrationCredentials } from '../integrations/types.js'
import type { SandataClientConfig } from '../integrations/sandata-client.js'

interface AgencySandataConfigRow {
  agency_id: string
  provider_id: string | null
  timezone: string
  caregiver_mappings: unknown
  service_mappings: unknown
  enabled: boolean
  api_base_url: string | null
  credentials_encrypted: string | null
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
  apiBaseUrl: string | null
  /** Read-only indicator — plaintext credentials are never returned to callers. */
  hasCredentials: boolean
}

/**
 * Upsert input. `credentials` is write-only and tri-state:
 *   undefined → leave the stored credentials unchanged
 *   null      → clear the stored credentials
 *   object    → encrypt (AES-256-GCM) and store
 */
export interface SandataConfigUpsert {
  agencyId: string
  providerId: string | null
  timezone: string
  caregivers: SandataCaregiverMapping[]
  services: SandataServiceMapping[]
  enabled: boolean
  apiBaseUrl?: string | null
  credentials?: IntegrationCredentials | null
}

function rowToPartial(row: AgencySandataConfigRow): PartialSandataConfig {
  return {
    agencyId: row.agency_id,
    providerId: row.provider_id,
    timezone: row.timezone || 'America/New_York',
    caregivers: parseCaregivers(row.caregiver_mappings),
    services: parseServices(row.service_mappings),
    enabled: Boolean(row.enabled),
    apiBaseUrl: row.api_base_url ?? null,
    hasCredentials: Boolean(row.credentials_encrypted),
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

  /**
   * Returns the full submission config WITH decrypted credentials — for the
   * Sandata client only. Never expose this to an API response; the admin UI
   * uses `findByAgency` (which carries `hasCredentials`, not the secret).
   */
  async findSubmissionConfig(agencyId: string): Promise<SandataClientConfig | undefined> {
    const row = (await this.db('agency_sandata_config')
      .where({ agency_id: agencyId })
      .first()) as AgencySandataConfigRow | undefined
    if (!row) return undefined

    let credentials: IntegrationCredentials | null = null
    if (row.credentials_encrypted) {
      const plain = decryptCell(row.credentials_encrypted)
      if (plain) {
        try {
          credentials = JSON.parse(plain) as IntegrationCredentials
        } catch {
          credentials = null
        }
      }
    }

    return {
      enabled: Boolean(row.enabled),
      apiBaseUrl: row.api_base_url ?? null,
      providerId: row.provider_id,
      credentials,
      caregivers: parseCaregivers(row.caregiver_mappings),
      services: parseServices(row.service_mappings),
    }
  }

  async upsert(input: SandataConfigUpsert): Promise<PartialSandataConfig> {
    const payload: Record<string, unknown> = {
      agency_id: input.agencyId,
      provider_id: input.providerId,
      timezone: input.timezone || 'America/New_York',
      caregiver_mappings: JSON.stringify(input.caregivers ?? []),
      service_mappings: JSON.stringify(input.services ?? []),
      enabled: input.enabled,
      updated_at: this.db.fn.now(),
    }
    // Tri-state: only touch these columns when the caller supplied them, so a
    // mappings-only save never wipes a previously stored endpoint / credentials.
    if (input.apiBaseUrl !== undefined) payload.api_base_url = input.apiBaseUrl
    if (input.credentials !== undefined) {
      payload.credentials_encrypted = input.credentials
        ? encryptCell(JSON.stringify(input.credentials))
        : null
    }

    await this.db('agency_sandata_config')
      .insert({ ...payload, created_at: this.db.fn.now() })
      .onConflict('agency_id')
      .merge(payload)

    const stored = await this.findByAgency(input.agencyId)
    if (!stored) {
      throw new Error(`upsert succeeded but no row found for agency=${input.agencyId}`)
    }
    return stored
  }
}
