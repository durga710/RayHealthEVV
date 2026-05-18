import type { Knex } from 'knex';
import type { AssignmentInput } from '../domain/scheduling.js';

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
}
