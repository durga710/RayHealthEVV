import type { Knex } from 'knex';
import type { EvvVisit } from '../domain/evv.js';

/**
 * EvvRepository
 *
 * Multi-tenancy: `evv_visits` has no `agency_id` column. Tenant isolation is
 * enforced by joining `users.caregiver_id` → `users.agency_id`. Every read
 * and update path takes an `agencyId` argument; the unfiltered `getAllVisits`
 * was retired because it leaked PHI across agencies (HIPAA reportable).
 */
export class EvvRepository {
  constructor(private readonly db: Knex) {}

  async createVisit(visit: EvvVisit): Promise<EvvVisit> {
    const [inserted] = await this.db('evv_visits')
      .insert({
        id: visit.id ?? crypto.randomUUID(),
        assignment_id: visit.assignmentId,
        caregiver_id: visit.caregiverId,
        // Cures-Act #1 / #2 — service code and beneficiary snapshotted at
        // clock-in. Both are nullable in the column but the Cures-Act
        // submission to PA aggregators requires both, so the route layer
        // supplies them on creation.
        service_code: visit.serviceCode ?? null,
        client_id: visit.clientId ?? null,
        clock_in_time: visit.clockInTime,
        clock_in_location: JSON.stringify(visit.clockInLocation),
        status: visit.status
      })
      .returning('*');

    return this.mapRowToVisit(inserted);
  }

  /**
   * Update a visit only if it belongs to the agency. Returns null when the
   * visit does not exist OR is on another tenant — callers cannot distinguish
   * the two cases (intentional: leaks neither existence nor tenancy).
   */
  async updateVisit(
    id: string,
    agencyId: string,
    visit: Partial<EvvVisit>
  ): Promise<EvvVisit | null> {
    const updateData: Record<string, unknown> = {};
    if (visit.clockOutTime) updateData.clock_out_time = visit.clockOutTime;
    if (visit.clockOutLocation)
      updateData.clock_out_location = JSON.stringify(visit.clockOutLocation);
    if (visit.status) updateData.status = visit.status;

    const allowedIds = this.db('evv_visits as v')
      .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
      .where('u.agency_id', agencyId)
      .andWhere('v.id', id)
      .select('v.id');

    const [updated] = await this.db('evv_visits')
      .whereIn('id', allowedIds)
      .update(updateData)
      .returning('*');

    return updated ? this.mapRowToVisit(updated) : null;
  }

  /**
   * Visits within an agency, most-recent first. This table grows without bound
   * over time, and this method backs a display list (GET /evv/visits) — not the
   * aggregator export (see getVisitsForExport, which is date-ranged). A generous
   * safety ceiling caps the response so a single request can't stream the entire
   * multi-year visit corpus (PHI + GPS) or exhaust memory as the table grows;
   * ordering by clock-in keeps the cap meaningful (the newest visits). Pass a
   * smaller `limit`/`offset` to page; the ceiling is always enforced.
   */
  async getVisitsForAgency(
    agencyId: string,
    opts: { limit?: number; offset?: number } = {}
  ): Promise<EvvVisit[]> {
    const MAX = 5000;
    const limit = Math.min(opts.limit ?? MAX, MAX);
    const offset = Math.max(opts.offset ?? 0, 0);
    const rows = await this.db('evv_visits as v')
      .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
      .where('u.agency_id', agencyId)
      .orderBy('v.clock_in_time', 'desc')
      .limit(limit)
      .offset(offset)
      .select('v.*');
    return rows.map((row) => this.mapRowToVisit(row));
  }

  /**
   * One caregiver's visits, tenant-scoped to an agency (for the admin
   * per-caregiver activity view). Combines the agency join
   * (users.caregiver_id → users.agency_id) with the snapshotted client's name
   * and the latest exception reason, so an admin sees a caregiver's history
   * with client context and the reason behind any flagged visit.
   */
  async getVisitsForCaregiverInAgency(
    caregiverId: string,
    agencyId: string
  ): Promise<Array<EvvVisit & { flagReason: string | null; clientName: string | null }>> {
    const rows = await this.db('evv_visits as v')
      .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
      .where('u.agency_id', agencyId)
      .andWhere('v.caregiver_id', caregiverId)
      .leftJoin('clients as c', 'c.id', 'v.client_id')
      .leftJoin(
        this.db.raw(
          `(
            SELECT DISTINCT ON (visit_id) visit_id, reason
            FROM evv_exceptions
            ORDER BY visit_id, created_at DESC
          ) as ex`
        ),
        'ex.visit_id',
        'v.id'
      )
      .select(
        'v.*',
        'c.first_name as client_first_name',
        'c.last_name as client_last_name',
        'ex.reason as flag_reason'
      );
    return rows.map((row) => {
      const first = (row.client_first_name as string | null) ?? null;
      const last = (row.client_last_name as string | null) ?? null;
      const clientName = first || last ? `${first ?? ''} ${last ?? ''}`.trim() : null;
      return {
        ...this.mapRowToVisit(row),
        flagReason: (row.flag_reason as string | null) ?? null,
        clientName,
      };
    });
  }

  /**
   * COUNT of visits in an agency — for dashboard tiles. Avoids pulling every
   * (PHI-bearing) visit row across the wire just to read `.length`.
   */
  async countVisitsForAgency(agencyId: string): Promise<number> {
    const row = await this.db('evv_visits as v')
      .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
      .where('u.agency_id', agencyId)
      .count<{ count: string }>('v.id as count')
      .first();
    return Number(row?.count ?? 0);
  }

  /** Single visit within an agency; returns null without leaking cross-tenant existence. */
  async getVisitByIdForAgency(id: string, agencyId: string): Promise<EvvVisit | null> {
    const row = await this.db('evv_visits as v')
      .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
      .where('u.agency_id', agencyId)
      .andWhere('v.id', id)
      .select('v.*')
      .first();

    return row ? this.mapRowToVisit(row) : null;
  }

  /**
   * Aggregator-export rows. Each row carries all seven 21st Century Cures
   * Act data points needed by HHAeXchange / Sandata:
   *   1. service_code   (evv_visits.service_code)
   *   2. client_id      (evv_visits.client_id, falls back to template's)
   *   3. service_date   (evv_visits.clock_in_time, date portion)
   *   4. location       (evv_visits.clock_in_location, lat/lng)
   *   5. caregiver_id   (evv_visits.caregiver_id)
   *   6. start_time     (evv_visits.clock_in_time)
   *   7. end_time       (evv_visits.clock_out_time)
   *
   * Tenant-scoped via users.agency_id (caregiver linkage). Optional date
   * range filters apply to clock_in_time.
   */
  async getVisitsForExport(
    agencyId: string,
    fromIso?: string,
    toIso?: string
  ): Promise<Array<{
    visitId: string;
    serviceCode: string | null;
    clientId: string | null;
    caregiverId: string;
    clockInTime: string;
    clockOutTime: string | null;
    clockInLocation: unknown;
    clockOutLocation: unknown;
    status: string;
  }>> {
    let q = this.db('evv_visits as v')
      .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
      .leftJoin('assignments as a', 'a.id', 'v.assignment_id')
      .leftJoin('visit_templates as t', 't.id', 'a.visit_template_id')
      .where('u.agency_id', agencyId)
      .select(
        'v.id as visit_id',
        'v.service_code',
        // Prefer the snapshot column on the visit itself; fall back to the
        // template's client_id for legacy rows that pre-date the Cures-Act
        // snapshot. coalesce keeps the row useful either way.
        this.db.raw('coalesce(v.client_id, t.client_id) as client_id'),
        'v.caregiver_id',
        'v.clock_in_time',
        'v.clock_out_time',
        'v.clock_in_location',
        'v.clock_out_location',
        'v.status'
      )
      .orderBy('v.clock_in_time', 'asc');
    if (fromIso) q = q.andWhere('v.clock_in_time', '>=', fromIso);
    if (toIso) q = q.andWhere('v.clock_in_time', '<=', toIso);
    const rows = await q;
    return rows.map((r: Record<string, unknown>) => ({
      visitId: r.visit_id as string,
      serviceCode: (r.service_code as string | null) ?? null,
      clientId: (r.client_id as string | null) ?? null,
      caregiverId: r.caregiver_id as string,
      clockInTime:
        r.clock_in_time instanceof Date ? r.clock_in_time.toISOString() : (r.clock_in_time as string),
      clockOutTime:
        r.clock_out_time instanceof Date
          ? r.clock_out_time.toISOString()
          : (r.clock_out_time as string | null),
      clockInLocation:
        typeof r.clock_in_location === 'string'
          ? JSON.parse(r.clock_in_location)
          : r.clock_in_location,
      clockOutLocation:
        typeof r.clock_out_location === 'string'
          ? JSON.parse(r.clock_out_location)
          : r.clock_out_location,
      status: r.status as string
    }));
  }

  /**
   * Visits for a single caregiver. Caller must pass req.auth.caregiverId.
   * Joins the most recent exception reason per visit so a flagged visit can
   * explain itself on the caregiver's history screen (null when not flagged /
   * no exception recorded).
   */
  async getVisitsForCaregiver(
    caregiverId: string
  ): Promise<Array<EvvVisit & { flagReason: string | null }>> {
    const rows = await this.db('evv_visits as v')
      .where({ 'v.caregiver_id': caregiverId })
      .leftJoin(
        this.db.raw(
          `(
            SELECT DISTINCT ON (visit_id) visit_id, reason
            FROM evv_exceptions
            ORDER BY visit_id, created_at DESC
          ) as ex`
        ),
        'ex.visit_id',
        'v.id'
      )
      .select('v.*', 'ex.reason as flag_reason');
    return rows.map((row) => ({
      ...this.mapRowToVisit(row),
      flagReason: (row.flag_reason as string | null) ?? null,
    }));
  }

  private mapRowToVisit(row: Record<string, unknown>): EvvVisit {
    const clockIn = row.clock_in_time;
    const clockOut = row.clock_out_time;
    const inLoc = row.clock_in_location;
    const outLoc = row.clock_out_location;
    return {
      id: row.id as string,
      assignmentId: row.assignment_id as string,
      caregiverId: row.caregiver_id as string,
      clientId: (row.client_id as string | null | undefined) ?? undefined,
      serviceCode: (row.service_code as EvvVisit['serviceCode']) ?? undefined,
      clockInTime:
        clockIn instanceof Date ? clockIn.toISOString() : (clockIn as string),
      clockOutTime:
        clockOut instanceof Date
          ? clockOut.toISOString()
          : (clockOut as string | undefined),
      clockInLocation:
        typeof inLoc === 'string'
          ? JSON.parse(inLoc)
          : (inLoc as EvvVisit['clockInLocation']),
      clockOutLocation:
        typeof outLoc === 'string'
          ? JSON.parse(outLoc)
          : (outLoc as EvvVisit['clockOutLocation']),
      status: row.status as EvvVisit['status'],
      sandataStatus: (row.sandata_status as EvvVisit['sandataStatus']) ?? null,
      sandataConfirmationId: (row.sandata_confirmation_id as string | null) ?? null
    };
  }

  /**
   * Record the outcome of a Sandata submission attempt. Only touches the two
   * aggregator-tracking columns; all immutable visit fields are left untouched.
   * Tenant-scoped via the caregiver → users → agency join so a rogue caller
   * cannot update a visit from a different agency.
   */
  /**
   * Bulk-mark every verified visit in a date range as `submitted` — the
   * write-back for "this batch was sent to the Sandata aggregator". Only
   * advances visits that are not yet in the aggregator pipeline
   * (sandata_status IS NULL or 'pending'); never downgrades an already
   * accepted/rejected/submitted row. Tenant-scoped via the caregiver → users
   * → agency join. Returns the number of rows advanced.
   */
  async markSandataSubmittedInRange(
    agencyId: string,
    fromIso?: string,
    toIso?: string
  ): Promise<number> {
    const allowedIds = this.db('evv_visits as v')
      .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
      .where('u.agency_id', agencyId)
      .andWhere('v.status', 'verified')
      .andWhere((b) =>
        b.whereNull('v.sandata_status').orWhere('v.sandata_status', 'pending')
      );
    if (fromIso) allowedIds.andWhere('v.clock_in_time', '>=', fromIso);
    if (toIso) allowedIds.andWhere('v.clock_in_time', '<=', toIso);

    const count = await this.db('evv_visits')
      .whereIn('id', allowedIds.select('v.id'))
      .update({ sandata_status: 'submitted' });

    return count;
  }

  async markSandataSubmission(
    visitId: string,
    agencyId: string,
    status: 'pending' | 'submitted' | 'accepted' | 'rejected',
    confirmationId?: string | null
  ): Promise<boolean> {
    const allowedIds = this.db('evv_visits as v')
      .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
      .where('u.agency_id', agencyId)
      .andWhere('v.id', visitId)
      .select('v.id');

    const count = await this.db('evv_visits')
      .whereIn('id', allowedIds)
      .update({
        sandata_status: status,
        ...(confirmationId !== undefined ? { sandata_confirmation_id: confirmationId } : {})
      });

    return count > 0;
  }

  /**
   * HHAeXchange analogue of {@link markSandataSubmittedInRange}. Bulk-advances
   * every verified visit in the range that is not yet in the HHAeXchange
   * pipeline (hhaexchange_status IS NULL or 'pending') to 'submitted'. Never
   * downgrades an accepted/rejected/submitted row. Tenant-scoped. Returns the
   * number of rows advanced.
   */
  async markHhaexchangeSubmittedInRange(
    agencyId: string,
    fromIso?: string,
    toIso?: string
  ): Promise<number> {
    const allowedIds = this.db('evv_visits as v')
      .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
      .where('u.agency_id', agencyId)
      .andWhere('v.status', 'verified')
      .andWhere((b) =>
        b.whereNull('v.hhaexchange_status').orWhere('v.hhaexchange_status', 'pending')
      );
    if (fromIso) allowedIds.andWhere('v.clock_in_time', '>=', fromIso);
    if (toIso) allowedIds.andWhere('v.clock_in_time', '<=', toIso);

    const count = await this.db('evv_visits')
      .whereIn('id', allowedIds.select('v.id'))
      .update({ hhaexchange_status: 'submitted' });

    return count;
  }

  /** HHAeXchange analogue of {@link markSandataSubmission}. Tenant-scoped. */
  async markHhaexchangeSubmission(
    visitId: string,
    agencyId: string,
    status: 'pending' | 'submitted' | 'accepted' | 'rejected',
    confirmationId?: string | null
  ): Promise<boolean> {
    const allowedIds = this.db('evv_visits as v')
      .join('users as u', 'u.caregiver_id', 'v.caregiver_id')
      .where('u.agency_id', agencyId)
      .andWhere('v.id', visitId)
      .select('v.id');

    const count = await this.db('evv_visits')
      .whereIn('id', allowedIds)
      .update({
        hhaexchange_status: status,
        ...(confirmationId !== undefined ? { hhaexchange_confirmation_id: confirmationId } : {})
      });

    return count > 0;
  }
}
