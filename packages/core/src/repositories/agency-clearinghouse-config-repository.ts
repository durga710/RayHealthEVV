/**
 * Repository for the `agency_clearinghouse_config` table.
 *
 * Stores per-agency claim-clearinghouse connection details: transport ('sftp'
 * or 'http'), endpoint, an AES-256-GCM encrypted credentials blob, and a
 * free-form settings object (submitter id, receiver id, directories). Parallel
 * in shape to the Sandata / HHAeXchange config repos.
 *
 * `findByAgency` returns a partial view with a `hasCredentials` flag for the
 * admin UI, the plaintext secret is never returned there. `findSubmissionConfig`
 * decrypts and is for the clearinghouse client only.
 */

import type { Knex } from 'knex'
import { encryptCell, decryptCell } from '../security/cell-cipher.js'
import type { IntegrationCredentials } from '../integrations/types.js'
import type { ClearinghouseClientConfig } from '../integrations/clearinghouse-client.js'

interface AgencyClearinghouseConfigRow {
  agency_id: string
  transport: string
  endpoint: string | null
  credentials_encrypted: string | null
  settings: unknown
  enabled: boolean
  created_at?: Date | string
  updated_at?: Date | string
}

function parseSettings(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  return {}
}

export interface PartialClearinghouseConfig {
  agencyId: string
  transport: string
  endpoint: string | null
  settings: Record<string, unknown>
  enabled: boolean
  /** Read-only indicator, plaintext credentials are never returned to callers. */
  hasCredentials: boolean
}

/**
 * Upsert input. `credentials` is write-only and tri-state:
 *   undefined → leave the stored credentials unchanged
 *   null      → clear the stored credentials
 *   object    → encrypt (AES-256-GCM) and store
 */
export interface ClearinghouseConfigUpsert {
  agencyId: string
  transport: string
  endpoint: string | null
  settings: Record<string, unknown>
  enabled: boolean
  credentials?: IntegrationCredentials | null
}

function rowToPartial(row: AgencyClearinghouseConfigRow): PartialClearinghouseConfig {
  return {
    agencyId: row.agency_id,
    transport: row.transport || 'sftp',
    endpoint: row.endpoint ?? null,
    settings: parseSettings(row.settings),
    enabled: Boolean(row.enabled),
    hasCredentials: Boolean(row.credentials_encrypted),
  }
}

export class AgencyClearinghouseConfigRepository {
  constructor(private readonly db: Knex) {}

  async findByAgency(agencyId: string): Promise<PartialClearinghouseConfig | undefined> {
    const row = (await this.db('agency_clearinghouse_config')
      .where({ agency_id: agencyId })
      .first()) as AgencyClearinghouseConfigRow | undefined
    return row ? rowToPartial(row) : undefined
  }

  /**
   * Returns the full submission config WITH decrypted credentials, for the
   * clearinghouse client only. Never expose this to an API response.
   */
  async findSubmissionConfig(agencyId: string): Promise<ClearinghouseClientConfig | undefined> {
    const row = (await this.db('agency_clearinghouse_config')
      .where({ agency_id: agencyId })
      .first()) as AgencyClearinghouseConfigRow | undefined
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
      transport: row.transport || 'sftp',
      endpoint: row.endpoint ?? null,
      credentials,
      settings: parseSettings(row.settings),
    }
  }

  async upsert(input: ClearinghouseConfigUpsert): Promise<PartialClearinghouseConfig> {
    const payload: Record<string, unknown> = {
      agency_id: input.agencyId,
      transport: input.transport || 'sftp',
      endpoint: input.endpoint,
      settings: JSON.stringify(input.settings ?? {}),
      enabled: input.enabled,
      updated_at: this.db.fn.now(),
    }
    if (input.credentials !== undefined) {
      payload.credentials_encrypted = input.credentials
        ? encryptCell(JSON.stringify(input.credentials))
        : null
    }

    await this.db('agency_clearinghouse_config')
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
