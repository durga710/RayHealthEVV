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

  async approve(id: string, approvedBy: string): Promise<EvvException | undefined> {
    const [row] = await this.db('evv_exceptions')
      .where({ id })
      .update({ approved_by: approvedBy, approved_at: new Date().toISOString() })
      .returning('*');
    return row ? this.mapRow(row) : undefined;
  }

  async findByVisit(visitId: string): Promise<EvvException[]> {
    const rows = await this.db('evv_exceptions').where({ visit_id: visitId });
    return rows.map((r: Record<string, unknown>) => this.mapRow(r));
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
