import type { Knex } from 'knex';
import type { AssignmentInput } from '../domain/scheduling.js';

export interface TodayScheduleItem {
  id: string;
  caregiverId: string;
  visitTemplateId: string;
  clientName: string;
  /** Null until a scheduled_date column lands on assignments table (planned migration). */
  scheduledTime: string | null;
  /** True if caregiver has already clocked in on this assignment today. */
  clockedInToday: boolean;
}

export class ScheduleRepository {
  constructor(private readonly db: Knex) {}

  async createTemplate(template: any): Promise<any> {
    const [inserted] = await this.db('visit_templates').insert({
      id: crypto.randomUUID(),
      client_id: template.clientId,
      name: template.name,
      tasks: JSON.stringify(template.tasks)
    }).returning('*');
    return {
      id: inserted.id,
      clientId: inserted.client_id,
      name: inserted.name,
      tasks: typeof inserted.tasks === 'string' ? JSON.parse(inserted.tasks) : inserted.tasks
    };
  }

  async getTemplates(agencyId: string): Promise<any[]> {
    const rows = await this.db('visit_templates')
      .join('clients', 'visit_templates.client_id', 'clients.id')
      .where('clients.agency_id', agencyId)
      .select('visit_templates.*');
    return rows.map(row => ({
      id: row.id,
      clientId: row.client_id,
      name: row.name,
      tasks: typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks
    }));
  }

  async createAssignment(assignment: AssignmentInput): Promise<any> {
    const [inserted] = await this.db('assignments').insert({
      id: crypto.randomUUID(),
      caregiver_id: assignment.caregiverId,
      visit_template_id: assignment.visitTemplateId
    }).returning('*');
    
    return {
      id: inserted.id,
      caregiverId: inserted.caregiver_id,
      visitTemplateId: inserted.visit_template_id
    };
  }

  async getAssignments(agencyId: string): Promise<any[]> {
    const rows = await this.db('assignments')
      .join('visit_templates', 'assignments.visit_template_id', 'visit_templates.id')
      .join('clients', 'visit_templates.client_id', 'clients.id')
      .where('clients.agency_id', agencyId)
      .select('assignments.*', 'clients.id as client_id');
      
    return rows.map(row => ({
      id: row.id,
      clientId: row.client_id,
      caregiverId: row.caregiver_id,
      visitTemplateId: row.visit_template_id
    }));
  }

  async getAssignmentsByCaregiver(caregiverId: string): Promise<any[]> {
    const rows = await this.db('assignments')
      .join('visit_templates', 'assignments.visit_template_id', 'visit_templates.id')
      .join('clients', 'visit_templates.client_id', 'clients.id')
      .where('assignments.caregiver_id', caregiverId)
      .select(
        'assignments.id', 
        'assignments.caregiver_id',
        'assignments.visit_template_id',
        'clients.first_name',
        'clients.last_name'
      );
      
    return rows.map(row => ({
      id: row.id,
      caregiverId: row.caregiver_id,
      visitTemplateId: row.visit_template_id,
      clientName: `${row.first_name} ${row.last_name}`
    }));
  }

  async getAssignmentForCaregiver(assignmentId: string, caregiverId: string): Promise<any | null> {
    const row = await this.db('assignments')
      .where({
        id: assignmentId,
        caregiver_id: caregiverId
      })
      .first();

    if (!row) return null;

    return {
      id: row.id,
      caregiverId: row.caregiver_id,
      visitTemplateId: row.visit_template_id
    };
  }

  /**
   * Returns all assignments for a caregiver, annotated with whether they have
   * already clocked in on that assignment today (UTC date).
   *
   * NOTE: The assignments table does not yet have a scheduled_date column, so
   * scheduledTime is always null. A follow-up migration will add that column and
   * populate this field. The shape is stable so mobile can handle null gracefully.
   */
  async getTodaySchedule(caregiverId: string, date: string): Promise<TodayScheduleItem[]> {
    const todayVisitsSubquery = this.db('evv_visits')
      .select('assignment_id')
      .whereRaw("DATE(clock_in_time) = ?", [date])
      .as('today_visits');

    const rows = await this.db('assignments')
      .join('visit_templates', 'assignments.visit_template_id', 'visit_templates.id')
      .join('clients', 'visit_templates.client_id', 'clients.id')
      .leftJoin(todayVisitsSubquery, 'today_visits.assignment_id', 'assignments.id')
      .where('assignments.caregiver_id', caregiverId)
      .select(
        'assignments.id',
        'assignments.caregiver_id',
        'assignments.visit_template_id',
        'clients.first_name',
        'clients.last_name',
        this.db.raw('(today_visits.assignment_id IS NOT NULL) as clocked_in_today'),
      );

    return rows.map((row: Record<string, unknown>) => ({
      id: row['id'] as string,
      caregiverId: row['caregiver_id'] as string,
      visitTemplateId: row['visit_template_id'] as string,
      clientName: `${row['first_name'] as string} ${row['last_name'] as string}`,
      scheduledTime: null,
      clockedInToday: Boolean(row['clocked_in_today']),
    }));
  }
}
