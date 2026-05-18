import type { Knex } from 'knex';
import type { EvvVisit } from '../domain/evv.js';

export class EvvRepository {
  constructor(private readonly db: Knex) {}

  async createVisit(visit: EvvVisit): Promise<EvvVisit> {
    const [inserted] = await this.db('evv_visits').insert({
      id: visit.id ?? crypto.randomUUID(),
      assignment_id: visit.assignmentId,
      caregiver_id: visit.caregiverId,
      clock_in_time: visit.clockInTime,
      clock_in_location: JSON.stringify(visit.clockInLocation),
      status: visit.status
    }).returning('*');
    
    return this.mapRowToVisit(inserted);
  }

  async updateVisit(id: string, visit: Partial<EvvVisit>): Promise<EvvVisit | null> {
    const updateData: any = {};
    if (visit.clockOutTime) updateData.clock_out_time = visit.clockOutTime;
    if (visit.clockOutLocation) updateData.clock_out_location = JSON.stringify(visit.clockOutLocation);
    if (visit.status) updateData.status = visit.status;

    const [updated] = await this.db('evv_visits')
      .where({ id })
      .update(updateData)
      .returning('*');
      
    return updated ? this.mapRowToVisit(updated) : null;
  }
  
  async getAllVisits(): Promise<EvvVisit[]> {
    const rows = await this.db('evv_visits').select('*');
    return rows.map(row => this.mapRowToVisit(row));
  }

  async getVisitById(id: string): Promise<EvvVisit | null> {
    const row = await this.db('evv_visits').where({ id }).first();
    return row ? this.mapRowToVisit(row) : null;
  }

  private mapRowToVisit(row: any): EvvVisit {
    return {
      id: row.id,
      assignmentId: row.assignment_id,
      caregiverId: row.caregiver_id,
      clockInTime: row.clock_in_time instanceof Date ? row.clock_in_time.toISOString() : row.clock_in_time,
      clockOutTime: row.clock_out_time instanceof Date ? row.clock_out_time.toISOString() : row.clock_out_time,
      clockInLocation: typeof row.clock_in_location === 'string' ? JSON.parse(row.clock_in_location) : row.clock_in_location,
      clockOutLocation: typeof row.clock_out_location === 'string' ? JSON.parse(row.clock_out_location) : row.clock_out_location,
      status: row.status
    };
  }
}
