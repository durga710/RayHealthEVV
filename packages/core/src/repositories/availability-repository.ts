/**
 * Repository for `caregiver_availability` and `time_off_requests`.
 *
 * Tenancy: every read and write takes an agencyId. Caregiver-facing reads also
 * filter on caregiver_id, because availability and leave are personal.
 *
 * `reason` and `review_note` may name a medical or family situation, so they
 * are treated as sensitive: agency-scoped queries only, never copied into a
 * notification body or an audit payload.
 */

import type { Knex } from 'knex'

export type TimeOffStatus = 'requested' | 'approved' | 'denied' | 'cancelled'

export interface AvailabilitySlot {
  id: string
  caregiverId: string
  /** 0 = Sunday .. 6 = Saturday. */
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface TimeOffRequest {
  id: string
  agencyId: string
  caregiverId: string
  startDate: string
  endDate: string
  reason: string | null
  status: TimeOffStatus
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string | null
}

function toIso(value: unknown): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

function toYmd(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

function mapSlot(row: Record<string, unknown>): AvailabilitySlot {
  return {
    id: String(row.id),
    caregiverId: String(row.caregiver_id),
    dayOfWeek: Number(row.day_of_week),
    startTime: String(row.start_time),
    endTime: String(row.end_time),
  }
}

function mapRequest(row: Record<string, unknown>): TimeOffRequest {
  return {
    id: String(row.id),
    agencyId: String(row.agency_id),
    caregiverId: String(row.caregiver_id),
    startDate: toYmd(row.start_date),
    endDate: toYmd(row.end_date),
    reason: row.reason ? String(row.reason) : null,
    status: (row.status as TimeOffStatus) ?? 'requested',
    reviewedAt: toIso(row.reviewed_at),
    reviewNote: row.review_note ? String(row.review_note) : null,
    createdAt: toIso(row.created_at),
  }
}

export class AvailabilityRepository {
  constructor(private readonly db: Knex) {}

  // ── Weekly availability ──────────────────────────────────────────────────

  async listAvailability(caregiverId: string, agencyId: string): Promise<AvailabilitySlot[]> {
    const rows = await this.db('caregiver_availability')
      .where({ caregiver_id: caregiverId, agency_id: agencyId })
      .orderBy('day_of_week')
      .orderBy('start_time')
      .select('*')
    return (rows as Record<string, unknown>[]).map(mapSlot)
  }

  /**
   * Replace a caregiver's whole weekly pattern in one transaction.
   *
   * Whole-pattern replace rather than per-slot edits: the UI is a weekly grid,
   * and a partial failure that left half the old week and half the new one
   * would be worse than either. The transaction means a caregiver never ends
   * up with no availability because a later insert failed.
   */
  async replaceAvailability(
    caregiverId: string,
    agencyId: string,
    slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
  ): Promise<AvailabilitySlot[]> {
    return this.db.transaction(async (trx) => {
      await trx('caregiver_availability')
        .where({ caregiver_id: caregiverId, agency_id: agencyId })
        .del()
      if (slots.length > 0) {
        await trx('caregiver_availability').insert(
          slots.map((s) => ({
            agency_id: agencyId,
            caregiver_id: caregiverId,
            day_of_week: s.dayOfWeek,
            start_time: s.startTime,
            end_time: s.endTime,
          })),
        )
      }
      const rows = await trx('caregiver_availability')
        .where({ caregiver_id: caregiverId, agency_id: agencyId })
        .orderBy('day_of_week')
        .orderBy('start_time')
        .select('*')
      return (rows as Record<string, unknown>[]).map(mapSlot)
    })
  }

  // ── Time off ─────────────────────────────────────────────────────────────

  async createTimeOff(input: {
    agencyId: string
    caregiverId: string
    startDate: string
    endDate: string
    reason?: string | null
  }): Promise<TimeOffRequest> {
    const [row] = await this.db('time_off_requests')
      .insert({
        agency_id: input.agencyId,
        caregiver_id: input.caregiverId,
        start_date: input.startDate,
        end_date: input.endDate,
        reason: input.reason ?? null,
        status: 'requested',
      })
      .returning('*')
    return mapRequest(row as Record<string, unknown>)
  }

  async listTimeOffForCaregiver(caregiverId: string, agencyId: string): Promise<TimeOffRequest[]> {
    const rows = await this.db('time_off_requests')
      .where({ caregiver_id: caregiverId, agency_id: agencyId })
      .orderBy('start_date', 'desc')
      .limit(200)
      .select('*')
    return (rows as Record<string, unknown>[]).map(mapRequest)
  }

  async listTimeOffForAgency(
    agencyId: string,
    options: { status?: TimeOffStatus; limit?: number } = {},
  ): Promise<TimeOffRequest[]> {
    let q = this.db('time_off_requests').where({ agency_id: agencyId })
    if (options.status) q = q.andWhere('status', options.status)
    const rows = await q
      .orderBy('start_date', 'desc')
      .limit(Math.min(options.limit ?? 500, 1000))
      .select('*')
    return (rows as Record<string, unknown>[]).map(mapRequest)
  }

  /**
   * Approve or deny. Only a `requested` row can be reviewed, which makes the
   * transition safe under a double click and stops a second reviewer silently
   * overturning the first answer.
   */
  async reviewTimeOff(
    id: string,
    agencyId: string,
    status: 'approved' | 'denied',
    reviewerId: string,
    note?: string | null,
  ): Promise<TimeOffRequest | null> {
    const [row] = await this.db('time_off_requests')
      .where({ id, agency_id: agencyId, status: 'requested' })
      .update({
        status,
        reviewed_by: reviewerId,
        reviewed_at: this.db.fn.now(),
        review_note: note ?? null,
        updated_at: this.db.fn.now(),
      })
      .returning('*')
    return row ? mapRequest(row as Record<string, unknown>) : null
  }

  /**
   * A caregiver withdrawing their own request. Allowed from `requested` OR
   * `approved`: plans change, and someone who no longer needs the day off
   * should be able to give it back without an awkward phone call. Marked
   * cancelled rather than deleted so the agency can see what happened.
   */
  async cancelOwnTimeOff(id: string, caregiverId: string, agencyId: string): Promise<boolean> {
    const updated = await this.db('time_off_requests')
      .where({ id, caregiver_id: caregiverId, agency_id: agencyId })
      .whereIn('status', ['requested', 'approved'])
      .update({ status: 'cancelled', updated_at: this.db.fn.now() })
    return updated > 0
  }

  /**
   * Approved leave overlapping a date, for the scheduling gate. Only
   * `approved` counts: a request nobody has answered yet must not silently
   * block the schedule, or an agency could be blocked by a request it has
   * never seen.
   */
  async findApprovedTimeOffOn(
    caregiverId: string,
    agencyId: string,
    date: string,
  ): Promise<TimeOffRequest | null> {
    const row = await this.db('time_off_requests')
      .where({ caregiver_id: caregiverId, agency_id: agencyId, status: 'approved' })
      .andWhere('start_date', '<=', date)
      .andWhere('end_date', '>=', date)
      .first('*')
    return row ? mapRequest(row as Record<string, unknown>) : null
  }
}
