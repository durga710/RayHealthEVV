import type { Knex } from 'knex';
import type { AssignmentInput } from '../domain/scheduling.js';
/**
 * Row shape returned by `getTodaysScheduleForCaregiver`. Strings are
 * ISO-8601 UTC; numerics are coerced from pg's text-decimal output.
 */
export type TodayScheduleRow = {
    assignmentId: string;
    scheduledStartTime: string | null;
    scheduledEndTime: string | null;
    clientId: string;
    clientFirstName: string;
    clientLastName: string;
    clientAddressLine1: string | null;
    clientCity: string | null;
    clientState: string | null;
    clientLatitude: number | null;
    clientLongitude: number | null;
    geofenceRadiusM: number;
    templateId: string;
    templateName: string;
    currentVisitId: string | null;
    currentVisitStatus: string | null;
    currentClockInTime: string | null;
    currentClockOutTime: string | null;
};
export declare class ScheduleRepository {
    private readonly db;
    constructor(db: Knex);
    createTemplate(template: any): Promise<any>;
    getTemplates(agencyId: string): Promise<any[]>;
    createAssignment(assignment: AssignmentInput): Promise<any>;
    getAssignments(agencyId: string): Promise<any[]>;
    getAssignmentsByCaregiver(caregiverId: string, agencyId?: string): Promise<any[]>;
    getAssignmentForCaregiver(assignmentId: string, caregiverId: string, agencyId?: string): Promise<any | null>;
    /**
     * Today's schedule for one caregiver — every assignment whose
     * `scheduled_start_time` falls in a 36-hour window around now (12 h back,
     * 24 h forward), joined with the client + visit template, plus an optional
     * LEFT-JOINed `evv_visits` row from earlier in the UTC day so the mobile
     * dashboard can surface "you're already clocked in" state.
     *
     * Tenant scope: enforced by joining `caregivers` and asserting
     * `caregivers.agency_id = ?`. We do NOT scope only by caregiver_id —
     * doing so would let a caregiver row that's been moved between agencies
     * leak its old assignments. Agency must match on the caregiver row that
     * owns the assignment.
     *
     * Why a 12-hour back-window: an overnight (NOC) shift that started at
     * 22:00 should still show up on the caregiver's dashboard at 06:00 the
     * next morning so they can clock out from the same screen.
     *
     * `NULLS LAST` on the order so caregivers with on-call (no scheduled
     * time) assignments still see them at the bottom rather than at top.
     */
    getTodaysScheduleForCaregiver(caregiverId: string, agencyId: string): Promise<TodayScheduleRow[]>;
}
//# sourceMappingURL=schedule-repository.d.ts.map