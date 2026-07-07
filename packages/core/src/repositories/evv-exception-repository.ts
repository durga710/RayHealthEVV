import type { Knex } from 'knex';
import type { EvvException } from '../domain/evv-exception.js';

export class EvvExceptionRepository {
  constructor(private readonly db: Knex) {}

  async create(exception: Omit<EvvException, 'id'>): Promise<EvvException> {
    const [row] = await this.db('evv_exceptions').insert({
      id: this.db.raw('gen_random_uuid()'),
      visit_id: exception.visitId,
      exception_type: exception.exceptionType,
      reason: exception.reason,
      approved_by: exception.approvedBy ?? null,
      approved_at: exception.approvedAt ?? null,
    }).returning('*');
    return this.mapRow(row);
  }

  // NOTE: an unscoped approve(id)/findByVisit(visitId) pair used to live here.
  // They took no agencyId and were unused, a cross-tenant footgun for the next
  // caller who wired them up. Deleted. The live, agency-scoped path is
  // ComplianceEngineRepository.acknowledgeException(agencyId, id, actorId),
  // which joins evv_exceptions -> evv_visits -> caregivers and re-checks the
  // agency. Add new exception mutations there (scoped), not here.

  /**
   * Agency-scoped exception read for a single visit, used by the audit
   * packet route (`GET /admin/audit-packet/:visitId`). Joins
   * evv_exceptions -> evv_visits -> caregivers and filters on
   * caregivers.agency_id, the same authorization pattern as
   * ComplianceEngineRepository.acknowledgeException. This is the only
   * sanctioned scoped-by-visit read on this table; do not add another
   * unscoped one (see the NOTE above).
   */
  async findExceptionsByVisitForAgency(visitId: string, agencyId: string): Promise<EvvException[]> {
    const rows = await this.db('evv_exceptions as e')
      .join('evv_visits as v', 'v.id', 'e.visit_id')
      .join('caregivers as c', 'c.id', 'v.caregiver_id')
      .where('c.agency_id', agencyId)
      .andWhere('e.visit_id', visitId)
      .orderBy('e.created_at', 'desc')
      .select('e.*');
    return rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: Record<string, unknown>): EvvException {
    return {
      id: row.id as string,
      visitId: row.visit_id as string,
      exceptionType: row.exception_type as EvvException['exceptionType'],
      reason: row.reason as string,
      approvedBy: row.approved_by as string | undefined,
      approvedAt: row.approved_at instanceof Date
        ? row.approved_at.toISOString()
        : row.approved_at as string | undefined,
    };
  }
}
