import type { Knex } from 'knex';
import type { AssignmentInput } from '../domain/scheduling.js';
export declare class ScheduleRepository {
    private readonly db;
    constructor(db: Knex);
    createTemplate(template: any): Promise<any>;
    getTemplates(agencyId: string): Promise<any[]>;
    createAssignment(assignment: AssignmentInput): Promise<any>;
    getAssignments(agencyId: string): Promise<any[]>;
    getAssignmentsByCaregiver(caregiverId: string, agencyId?: string): Promise<any[]>;
    getAssignmentForCaregiver(assignmentId: string, caregiverId: string, agencyId?: string): Promise<any | null>;
}
//# sourceMappingURL=schedule-repository.d.ts.map