/**
 * Repository for the `push_tokens` table.
 *
 * Tenancy: rows are keyed on (token, agency_id). One mobile identity can work
 * at several agencies, so the same device token legitimately appears once per
 * agency the caregiver belongs to. Every read here is agency-scoped, which is
 * what keeps a send by agency A from ever touching agency B's row and keeps
 * the standing rule that an agency cannot observe that a caregiver also works
 * somewhere else.
 *
 * Nothing in this table is PHI: a device token, a platform string, and
 * timestamps.
 */

import type { Knex } from 'knex'

export interface PushToken {
  id: string
  agencyId: string
  userId: string
  caregiverId: string | null
  token: string
  platform: string
  lastSeenAt: string | null
  disabledAt: string | null
}

export interface RegisterPushTokenInput {
  agencyId: string
  userId: string
  caregiverId?: string | null
  token: string
  platform?: string
}

function toIso(value: unknown): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

function mapRow(row: Record<string, unknown>): PushToken {
  return {
    id: String(row.id),
    agencyId: String(row.agency_id),
    userId: String(row.user_id),
    caregiverId: row.caregiver_id ? String(row.caregiver_id) : null,
    token: String(row.token),
    platform: String(row.platform ?? 'unknown'),
    lastSeenAt: toIso(row.last_seen_at),
    disabledAt: toIso(row.disabled_at),
  }
}

export class PushTokenRepository {
  constructor(private readonly db: Knex) {}

  /**
   * Record (or refresh) a device token for one user in one agency.
   *
   * Re-registering clears `disabled_at`: the app is demonstrably installed
   * and asking for notifications again, which is the only reliable signal
   * that a previously dead token is alive. It also rewrites user/caregiver,
   * so a shared device that a second caregiver logs into stops delivering
   * the first caregiver's notifications.
   */
  async register(input: RegisterPushTokenInput): Promise<PushToken> {
    const payload = {
      agency_id: input.agencyId,
      user_id: input.userId,
      caregiver_id: input.caregiverId ?? null,
      token: input.token,
      platform: input.platform ?? 'unknown',
      last_seen_at: this.db.fn.now(),
      disabled_at: null,
      disabled_reason: null,
      updated_at: this.db.fn.now(),
    }
    const [row] = await this.db('push_tokens')
      .insert({ ...payload, created_at: this.db.fn.now() })
      .onConflict(['token', 'agency_id'])
      .merge(payload)
      .returning('*')
    return mapRow(row as Record<string, unknown>)
  }

  /**
   * Forget a token for one agency, on sign-out. Scoped to the caller's agency
   * so signing out of agency A does not silence agency B on the same device.
   */
  async unregister(token: string, agencyId: string): Promise<boolean> {
    const deleted = await this.db('push_tokens').where({ token, agency_id: agencyId }).del()
    return deleted > 0
  }

  /** Live tokens for a set of caregivers within one agency. */
  async listForCaregivers(agencyId: string, caregiverIds: string[]): Promise<PushToken[]> {
    if (caregiverIds.length === 0) return []
    const rows = await this.db('push_tokens')
      .where({ agency_id: agencyId })
      .whereIn('caregiver_id', caregiverIds)
      .whereNull('disabled_at')
      .select('*')
    return (rows as Record<string, unknown>[]).map(mapRow)
  }

  /** Live tokens for a set of users within one agency. */
  async listForUsers(agencyId: string, userIds: string[]): Promise<PushToken[]> {
    if (userIds.length === 0) return []
    const rows = await this.db('push_tokens')
      .where({ agency_id: agencyId })
      .whereIn('user_id', userIds)
      .whereNull('disabled_at')
      .select('*')
    return (rows as Record<string, unknown>[]).map(mapRow)
  }

  /**
   * Retire tokens the push service reported as dead (app uninstalled,
   * notifications revoked). Retired rather than deleted so a later redelivery
   * attempt does not resurrect them; re-registering from the device clears the
   * flag. Not agency-scoped on purpose: a token the push service says is gone
   * is gone for every agency that holds it.
   */
  async disableTokens(tokens: string[], reason: string): Promise<number> {
    if (tokens.length === 0) return 0
    return this.db('push_tokens')
      .whereIn('token', tokens)
      .whereNull('disabled_at')
      .update({
        disabled_at: this.db.fn.now(),
        disabled_reason: reason.slice(0, 64),
        updated_at: this.db.fn.now(),
      })
  }
}
