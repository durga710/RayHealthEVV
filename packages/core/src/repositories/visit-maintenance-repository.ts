import type { Knex } from 'knex';
import type { VisitMaintenance } from '../domain/visit-maintenance.js';

export class VisitMaintenanceRepository {
  constructor(private readonly db: Knex) {}

  async requestUnlock(maintenance: VisitMaintenance): Promise<VisitMaintenance> {
    const [inserted] = await this.db('visit_maintenance').insert({
      id: maintenance.id ?? crypto.randomUUID(),
      visit_id: maintenance.visitId,
      requester_id: maintenance.requesterId,
      reason: maintenance.reason,
      status: 'pending'
    }).returning('*');
    
    return this.mapRowToMaintenance(inserted);
  }

  async approveUnlock(id: string, adjustedTimes: { start: string; end: string }): Promise<VisitMaintenance | null> {
    const [updated] = await this.db('visit_maintenance')
      .where({ id })
      .update({
        status: 'approved',
        adjusted_start_time: adjustedTimes.start,
        adjusted_end_time: adjustedTimes.end,
      })
      .returning('*');
    return updated ? this.mapRowToMaintenance(updated) : null;
  }

  async rejectUnlock(id: string, reason?: string): Promise<VisitMaintenance | null> {
    const update: Record<string, unknown> = { status: 'rejected' };
    if (reason !== undefined) update.reason = reason;
    const [updated] = await this.db('visit_maintenance').where({ id }).update(update).returning('*');
    return updated ? this.mapRowToMaintenance(updated) : null;
  }

  async getPendingQueue(agencyId: string): Promise<VisitMaintenance[]> {
    const rows = await this.db('visit_maintenance as vm')
      .join('visits as v', 'vm.visit_id', 'v.id')
      .where({ 'v.agency_id': agencyId, 'vm.status': 'pending' })
      .select('vm.*');
    return rows.map((r: Record<string, unknown>) => this.mapRowToMaintenance(r));
  }

  async getHistory(agencyId: string): Promise<VisitMaintenance[]> {
    const rows = await this.db('visit_maintenance as vm')
      .join('visits as v', 'vm.visit_id', 'v.id')
      .where('v.agency_id', agencyId)
      .whereNot('vm.status', 'pending')
      .select('vm.*');
    return rows.map((r: Record<string, unknown>) => this.mapRowToMaintenance(r));
  }

  async getByVisitId(visitId: string): Promise<VisitMaintenance[]> {
    const rows = await this.db('visit_maintenance').where({ visit_id: visitId });
    return rows.map((r: Record<string, unknown>) => this.mapRowToMaintenance(r));
  }

  private mapRowToMaintenance(row: Record<string, unknown>): VisitMaintenance {
    const asDate = (v: unknown): string | undefined => {
      if (!v) return undefined;
      return v instanceof Date ? v.toISOString() : String(v);
    };
    return {
      id: row.id as string,
      visitId: row.visit_id as string,
      requesterId: row.requester_id as string,
      reason: row.reason as string,
      status: row.status as 'pending' | 'approved' | 'rejected',
      adjustedStartTime: asDate(row.adjusted_start_time),
      adjustedEndTime: asDate(row.adjusted_end_time),
    };
  }
}