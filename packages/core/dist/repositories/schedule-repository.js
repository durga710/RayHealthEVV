function toIsoOrNull(value) {
    if (value === null || value === undefined)
        return null;
    if (value instanceof Date)
        return value.toISOString();
    return new Date(String(value)).toISOString();
}
export class ScheduleRepository {
    constructor(db) {
        this.db = db;
    }
    async createTemplate(template) {
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
    async getTemplates(agencyId) {
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
    async createAssignment(assignment) {
        const scheduledStart = assignment.visitDate
            ? new Date(`${assignment.visitDate}T00:00:00.000Z`).toISOString()
            : null;
        const [inserted] = await this.db('assignments').insert({
            id: crypto.randomUUID(),
            caregiver_id: assignment.caregiverId,
            visit_template_id: assignment.visitTemplateId,
            ...(scheduledStart ? { scheduled_start_time: scheduledStart } : {})
        }).returning('*');
        return {
            id: inserted.id,
            caregiverId: inserted.caregiver_id,
            visitTemplateId: inserted.visit_template_id,
            visitDate: inserted.scheduled_start_time
                ? new Date(inserted.scheduled_start_time).toISOString().slice(0, 10)
                : undefined
        };
    }
    async getAssignments(agencyId) {
        const rows = await this.db('assignments')
            .join('visit_templates', 'assignments.visit_template_id', 'visit_templates.id')
            .join('clients', 'visit_templates.client_id', 'clients.id')
            .where('clients.agency_id', agencyId)
            .select('assignments.*', 'clients.id as client_id');
        return rows.map(row => ({
            id: row.id,
            clientId: row.client_id,
            caregiverId: row.caregiver_id,
            visitTemplateId: row.visit_template_id,
            visitDate: row.scheduled_start_time
                ? new Date(row.scheduled_start_time).toISOString().slice(0, 10)
                : undefined
        }));
    }
    async getAssignmentsByCaregiver(caregiverId, agencyId) {
        const query = this.db('assignments')
            .join('visit_templates', 'assignments.visit_template_id', 'visit_templates.id')
            .join('clients', 'visit_templates.client_id', 'clients.id')
            .leftJoin('authorizations', 'authorizations.client_id', 'clients.id')
            .where('assignments.caregiver_id', caregiverId)
            .select('assignments.id', 'assignments.caregiver_id', 'assignments.visit_template_id', 'clients.id as client_id', 'clients.first_name', 'clients.last_name', 'authorizations.service_code')
            .orderBy('authorizations.end_date', 'desc');
        if (agencyId)
            query.andWhere('clients.agency_id', agencyId);
        const rows = await query;
        return rows.map(row => ({
            id: row.id,
            caregiverId: row.caregiver_id,
            visitTemplateId: row.visit_template_id,
            clientId: row.client_id,
            clientName: `${row.first_name} ${row.last_name}`,
            serviceCode: row.service_code ?? undefined
        }));
    }
    async getAssignmentForCaregiver(assignmentId, caregiverId, agencyId) {
        const query = this.db('assignments')
            .join('visit_templates', 'assignments.visit_template_id', 'visit_templates.id')
            .join('clients', 'visit_templates.client_id', 'clients.id')
            .leftJoin('authorizations', 'authorizations.client_id', 'clients.id')
            .where('assignments.id', assignmentId)
            .andWhere('assignments.caregiver_id', caregiverId)
            .select('assignments.id', 'assignments.caregiver_id', 'assignments.visit_template_id', 'clients.id as client_id', 'authorizations.service_code')
            .orderBy('authorizations.end_date', 'desc');
        if (agencyId)
            query.andWhere('clients.agency_id', agencyId);
        const row = await query.first();
        if (!row)
            return null;
        return {
            id: row.id,
            caregiverId: row.caregiver_id,
            visitTemplateId: row.visit_template_id,
            clientId: row.client_id,
            serviceCode: row.service_code ?? undefined
        };
    }
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
    async getTodaysScheduleForCaregiver(caregiverId, agencyId) {
        const rows = await this.db('assignments as a')
            .innerJoin('caregivers as cg', 'cg.id', 'a.caregiver_id')
            .innerJoin('visit_templates as vt', 'vt.id', 'a.visit_template_id')
            .innerJoin('clients as c', 'c.id', 'vt.client_id')
            // LEFT JOIN evv_visits via a DISTINCT-ON subquery so an
            // assignment with multiple visits today (e.g. a completed and a
            // re-started one) collapses to ONE row in the result. Without
            // the subquery the plain `leftJoin('evv_visits as v', ...)`
            // multiplied rows by the visit count, so the mobile schedule
            // tab showed the same client twice. The subquery also handles
            // the "today only" narrowing inline, replacing the CASE-WHEN
            // gymnastics in the SELECT.
            .leftJoin(this.db.raw(`(
            SELECT DISTINCT ON (assignment_id)
              assignment_id,
              id,
              status,
              clock_in_time,
              clock_out_time
            FROM evv_visits
            WHERE clock_in_time::date = (current_date AT TIME ZONE 'UTC')
            ORDER BY assignment_id, clock_in_time DESC
          ) as v`), 'v.assignment_id', 'a.id')
            .where('a.caregiver_id', caregiverId)
            .andWhere('cg.agency_id', agencyId)
            .andWhereRaw("a.scheduled_start_time BETWEEN (now() - interval '12 hours') AND (now() + interval '24 hours')")
            .orderByRaw('a.scheduled_start_time ASC NULLS LAST')
            .select('a.id as assignment_id', 'a.scheduled_start_time', 'a.scheduled_end_time', 'c.id as client_id', 'c.first_name as client_first_name', 'c.last_name as client_last_name', 'c.address_line_1 as client_address_line_1', 'c.city as client_city', 'c.state as client_state', 'c.latitude as client_latitude', 'c.longitude as client_longitude', 'c.geofence_radius_m as geofence_radius_m', 'vt.id as template_id', 'vt.name as template_name', 
        // The DISTINCT-ON subquery above has already narrowed v.* to
        // today's latest visit per assignment, so we can read columns
        // directly. NULL when no visit exists today.
        'v.id as current_visit_id', 'v.status as current_visit_status', 'v.clock_in_time as current_clock_in_time', 'v.clock_out_time as current_clock_out_time');
        return rows.map((row) => ({
            assignmentId: row.assignment_id,
            scheduledStartTime: toIsoOrNull(row.scheduled_start_time),
            scheduledEndTime: toIsoOrNull(row.scheduled_end_time),
            clientId: row.client_id,
            clientFirstName: row.client_first_name,
            clientLastName: row.client_last_name,
            clientAddressLine1: row.client_address_line_1 ?? null,
            clientCity: row.client_city ?? null,
            clientState: row.client_state ?? null,
            clientLatitude: row.client_latitude === null || row.client_latitude === undefined
                ? null
                : Number(row.client_latitude),
            clientLongitude: row.client_longitude === null || row.client_longitude === undefined
                ? null
                : Number(row.client_longitude),
            geofenceRadiusM: row.geofence_radius_m === null || row.geofence_radius_m === undefined
                ? 150
                : Number(row.geofence_radius_m),
            templateId: row.template_id,
            templateName: row.template_name,
            currentVisitId: row.current_visit_id ?? null,
            currentVisitStatus: row.current_visit_status ?? null,
            currentClockInTime: toIsoOrNull(row.current_clock_in_time),
            currentClockOutTime: toIsoOrNull(row.current_clock_out_time)
        }));
    }
}
//# sourceMappingURL=schedule-repository.js.map