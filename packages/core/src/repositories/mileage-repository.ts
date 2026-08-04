/**
 * Repository for `mileage_entries`.
 *
 * Tenancy: every read and write takes an agencyId and filters on it. Caregiver
 * reads additionally filter on caregiver_id, because a caregiver may see only
 * their own trips.
 *
 * `purpose` is caregiver-authored free text and must be treated as potentially
 * PHI: somebody will eventually type a client's name into it. It never leaves
 * an agency-scoped query and never lands in a notification or audit payload.
 */

import type { Knex } from 'knex'

export type MileageStatus = 'submitted' | 'approved' | 'rejected'

export interface MileageEntry {
  id: string
  agencyId: string
  caregiverId: string
  visitId: string | null
  tripDate: string
  /** Miles to two decimals, stored as hundredths (12.34 mi = 1234). */
  milesHundredths: number
  purpose: string | null
  status: MileageStatus
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string | null
}

export interface NewMileageEntry {
  agencyId: string
  caregiverId: string
  visitId?: string | null
  tripDate: string
  milesHundredths: number
  purpose?: string | null
}

function toIso(value: unknown): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

/** Dates come back as Date or string depending on driver; normalize to YYYY-MM-DD. */
function toYmd(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

function mapRow(row: Record<string, unknown>): MileageEntry {
  return {
    id: String(row.id),
    agencyId: String(row.agency_id),
    caregiverId: String(row.caregiver_id),
    visitId: row.visit_id ? String(row.visit_id) : null,
    tripDate: toYmd(row.trip_date),
    milesHundredths: Number(row.miles_hundredths),
    purpose: row.purpose ? String(row.purpose) : null,
    status: (row.status as MileageStatus) ?? 'submitted',
    reviewedAt: toIso(row.reviewed_at),
    reviewNote: row.review_note ? String(row.review_note) : null,
    createdAt: toIso(row.created_at),
  }
}

export class MileageRepository {
  constructor(private readonly db: Knex) {}

  async create(input: NewMileageEntry): Promise<MileageEntry> {
    const [row] = await this.db('mileage_entries')
      .insert({
        agency_id: input.agencyId,
        caregiver_id: input.caregiverId,
        visit_id: input.visitId ?? null,
        trip_date: input.tripDate,
        miles_hundredths: input.milesHundredths,
        purpose: input.purpose ?? null,
        status: 'submitted',
      })
      .returning('*')
    return mapRow(row as Record<string, unknown>)
  }

  /** One caregiver's own trips, newest first, bounded by an optional range. */
  async listForCaregiver(
    caregiverId: string,
    agencyId: string,
    options: { from?: string; to?: string; limit?: number } = {},
  ): Promise<MileageEntry[]> {
    let q = this.db('mileage_entries')
      .where({ caregiver_id: caregiverId, agency_id: agencyId })
      .orderBy('trip_date', 'desc')
      .orderBy('created_at', 'desc')
    if (options.from) q = q.andWhere('trip_date', '>=', options.from)
    if (options.to) q = q.andWhere('trip_date', '<=', options.to)
    const rows = await q.limit(Math.min(options.limit ?? 200, 500)).select('*')
    return (rows as Record<string, unknown>[]).map(mapRow)
  }

  /** Agency-wide review queue, optionally filtered by status. */
  async listForAgency(
    agencyId: string,
    options: { status?: MileageStatus; from?: string; to?: string; limit?: number } = {},
  ): Promise<MileageEntry[]> {
    let q = this.db('mileage_entries').where({ agency_id: agencyId })
    if (options.status) q = q.andWhere('status', options.status)
    if (options.from) q = q.andWhere('trip_date', '>=', options.from)
    if (options.to) q = q.andWhere('trip_date', '<=', options.to)
    const rows = await q
      .orderBy('trip_date', 'desc')
      .limit(Math.min(options.limit ?? 500, 1000))
      .select('*')
    return (rows as Record<string, unknown>[]).map(mapRow)
  }

  /**
   * Approve or reject a submitted entry.
   *
   * Only a `submitted` row can be reviewed. That is what makes the transition
   * idempotent-safe: two coordinators clicking approve at once cannot produce
   * two approvals, and a rejected entry cannot be quietly flipped to approved
   * without the caregiver resubmitting.
   */
  async review(
    id: string,
    agencyId: string,
    status: 'approved' | 'rejected',
    reviewerId: string,
    note?: string | null,
  ): Promise<MileageEntry | null> {
    const [row] = await this.db('mileage_entries')
      .where({ id, agency_id: agencyId, status: 'submitted' })
      .update({
        status,
        reviewed_by: reviewerId,
        reviewed_at: this.db.fn.now(),
        review_note: note ?? null,
        updated_at: this.db.fn.now(),
      })
      .returning('*')
    return row ? mapRow(row as Record<string, unknown>) : null
  }

  /**
   * Delete a caregiver's own entry. Scoped to the caregiver AND to
   * `submitted`: once an agency has ruled on a trip, the record of that
   * decision is not the caregiver's to erase.
   */
  async deleteOwnSubmitted(id: string, caregiverId: string, agencyId: string): Promise<boolean> {
    const deleted = await this.db('mileage_entries')
      .where({ id, caregiver_id: caregiverId, agency_id: agencyId, status: 'submitted' })
      .del()
    return deleted > 0
  }
}
