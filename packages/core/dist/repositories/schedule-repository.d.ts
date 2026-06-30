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
    /** Resolve the client a visit template belongs to, scoped to the agency. */
    getTemplateClient(visitTemplateId: string, agencyId: string): Promise<{
        clientId: string;
    } | null>;
    /**
     * Existing (template, date) pairs for a caregiver — for duplicate detection.
     * `excludeAssignmentId` omits one assignment from the result so a reschedule of
     * an existing assignment doesn't flag itself as a duplicate.
     */
    getCaregiverScheduleForConflict(caregiverId: string, agencyId: string, excludeAssignmentId?: string): Promise<Array<{
        visitTemplateId: string;
        visitDate?: string;
    }>>;
    /**
     * One assignment with its resolved client + scheduled date, tenant-scoped.
     * Used by the reschedule/reassign path to merge a partial patch over the
     * current values before re-running the conflict gate. Null = unknown/cross-tenant.
     */
    getAssignmentById(assignmentId: string, agencyId: string): Promise<{
        id: string;
        caregiverId: string;
        visitTemplateId: string;
        clientId: string;
        visitDate?: string;
    } | null>;
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
    /**
     * Forward-looking schedule for one caregiver — every assignment whose
     * `scheduled_start_time` falls between the start of today and `daysAhead`
     * days from now. Same row shape, joins, and tenant scope as
     * getTodaysScheduleForCaregiver, but a wider window so the mobile app can
     * render a multi-day agenda. The today-only evv_visits overlay is retained
     * so an in-progress visit still surfaces on today's rows; future days simply
     * have null current-visit fields.
     *
     * `daysAhead` is clamped by the caller; bound as a parameter (never string
     * interpolated) to keep the interval arithmetic injection-safe.
     */
    getUpcomingScheduleForCaregiver(caregiverId: string, agencyId: string, daysAhead?: number): Promise<TodayScheduleRow[]>;
    /**
     * Tenant-scoped (via client join) template update. Only provided fields are
     * written. Returns the updated template, or null when unknown / cross-tenant.
     */
    updateTemplate(templateId: string, agencyId: string, patch: {
        name?: string;
        tasks?: unknown;
    }): Promise<any | null>;
    /**
     * Delete a template, tenant-scoped. Refuses ('has_dependencies') when any
     * assignment still references it. 'not_found' for unknown / cross-tenant id.
     */
    deleteTemplate(templateId: string, agencyId: string): Promise<'deleted' | 'not_found' | 'has_dependencies'>;
    /** True when the assignment exists and belongs to the agency (via template→client). */
    assignmentInAgency(assignmentId: string, agencyId: string): Promise<boolean>;
    /**
     * Tenant-scoped assignment update. Supports rescheduling (visitDate, null to
     * clear) and reassigning caregiver/template. The caller MUST validate that any
     * new caregiverId / visitTemplateId belongs to the agency first. Returns null
     * when the assignment is unknown / cross-tenant.
     */
    updateAssignment(assignmentId: string, agencyId: string, patch: {
        caregiverId?: string;
        visitTemplateId?: string;
        visitDate?: string | null;
    }): Promise<any | null>;
    /**
     * Delete (cancel) an assignment, tenant-scoped. Refuses ('has_dependencies')
     * when an EVV visit already exists for it — those carry verified clock-in/out
     * history. 'not_found' for unknown / cross-tenant id.
     */
    deleteAssignment(assignmentId: string, agencyId: string): Promise<'deleted' | 'not_found' | 'has_dependencies'>;
}
//# sourceMappingURL=schedule-repository.d.ts.map