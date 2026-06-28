import type { Knex } from 'knex';
import type { RecurringSchedule, RecurringScheduleStatus } from '../domain/recurring-schedule.js';
/** A recurring schedule joined with display names, for the list view. */
export interface RecurringScheduleView {
    id: string;
    caregiverId: string;
    caregiverName: string | null;
    visitTemplateId: string;
    templateName: string;
    clientName: string;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    startDate: string;
    endDate: string;
    status: RecurringScheduleStatus;
}
export interface MaterializeResult {
    scheduleId: string;
    created: number;
    skipped: number;
}
export declare class RecurringScheduleRepository {
    private readonly db;
    constructor(db: Knex);
    create(agencyId: string, s: RecurringSchedule): Promise<{
        id: string;
    }>;
    list(agencyId: string): Promise<RecurringScheduleView[]>;
    setStatus(agencyId: string, id: string, status: RecurringScheduleStatus): Promise<boolean>;
    remove(agencyId: string, id: string): Promise<boolean>;
    /**
     * Materialize one recurring schedule into concrete `assignments` for the
     * [windowStart, windowEnd] window. Idempotent: an occurrence date that
     * already has an assignment for the same caregiver + visit template (whether
     * from a prior run or a manual booking) is skipped, never duplicated. Paused
     * / ended schedules generate nothing. Throws if the schedule or its template
     * isn't in the agency.
     */
    materialize(agencyId: string, scheduleId: string, windowStart: string, windowEnd: string): Promise<MaterializeResult>;
    /** Materialize every active schedule in the agency. */
    materializeAllActive(agencyId: string, windowStart: string, windowEnd: string): Promise<MaterializeResult[]>;
}
//# sourceMappingURL=recurring-schedule-repository.d.ts.map