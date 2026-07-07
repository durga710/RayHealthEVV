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

function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
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

  /**
   * Scheduled start/end for one assignment, tenant-scoped via
   * assignments -> visit_templates -> clients.agency_id (same join used by
   * {@link assignmentInAgency}). Used by the audit packet route to show
   * scheduled-vs-actual alongside a visit's clock-in/out. Null when the
   * assignment is unknown / cross-tenant, the caller treats that as "no
   * schedule data", not an error.
   */
  async getAssignmentScheduleForAgency(
    assignmentId: string,
    agencyId: string
  ): Promise<{ scheduledStartTime: string | null; scheduledEndTime: string | null } | null> {
    const row = await this.db('assignments as a')
      .join('visit_templates as vt', 'vt.id', 'a.visit_template_id')
      .join('clients as c', 'c.id', 'vt.client_id')
      .where('c.agency_id', agencyId)
      .andWhere('a.id', assignmentId)
      .select('a.scheduled_start_time', 'a.scheduled_end_time')
      .first();
    if (!row) return null;
    return {
      scheduledStartTime: toIsoOrNull(row.scheduled_start_time),
      scheduledEndTime: toIsoOrNull(row.scheduled_end_time)
    };
  }

  /** True when the client exists and belongs to the given agency. */
  async clientBelongsToAgency(clientId: string, agencyId: string): Promise<boolean> {
    const row = await this.db('clients')
      .where({ id: clientId, agency_id: agencyId })
      .first('id');
    return Boolean(row);
  }

  /** Resolve the client a visit template belongs to, scoped to the agency. */
  async getTemplateClient(
    visitTemplateId: string,
    agencyId: string,
  ): Promise<{ clientId: string } | null> {
    const row = await this.db('visit_templates')
      .join('clients', 'visit_templates.client_id', 'clients.id')
      .where('visit_templates.id', visitTemplateId)
      .andWhere('clients.agency_id', agencyId)
      .select('clients.id as client_id')
      .first();
    return row ? { clientId: row.client_id as string } : null;
  }

  /**
   * Existing (template, date) pairs for a caregiver, for duplicate detection.
   * `excludeAssignmentId` omits one assignment from the result so a reschedule of
   * an existing assignment doesn't flag itself as a duplicate.
   */
  async getCaregiverScheduleForConflict(
    caregiverId: string,
    agencyId: string,
    excludeAssignmentId?: string,
  ): Promise<Array<{ visitTemplateId: string; visitDate?: string }>> {
    const query = this.db('assignments')
      .join('visit_templates', 'assignments.visit_template_id', 'visit_templates.id')
      .join('clients', 'visit_templates.client_id', 'clients.id')
      .where('assignments.caregiver_id', caregiverId)
      .andWhere('clients.agency_id', agencyId);
    if (excludeAssignmentId) query.andWhereNot('assignments.id', excludeAssignmentId);
    const rows = await query.select(
      'assignments.visit_template_id',
      'assignments.scheduled_start_time',
    );
    return rows.map((row) => ({
      visitTemplateId: row.visit_template_id as string,
      visitDate: row.scheduled_start_time
        ? new Date(row.scheduled_start_time as string | Date).toISOString().slice(0, 10)
        : undefined,
    }));
  }

  /**
   * One assignment with its resolved client + scheduled date, tenant-scoped.
   * Used by the reschedule/reassign path to merge a partial patch over the
   * current values before re-running the conflict gate. Null = unknown/cross-tenant.
   */
  async getAssignmentById(
    assignmentId: string,
    agencyId: string,
  ): Promise<{ id: string; caregiverId: string; visitTemplateId: string; clientId: string; visitDate?: string } | null> {
    const row = await this.db('assignments')
      .join('visit_templates', 'assignments.visit_template_id', 'visit_templates.id')
      .join('clients', 'visit_templates.client_id', 'clients.id')
      .where('assignments.id', assignmentId)
      .andWhere('clients.agency_id', agencyId)
      .select(
        'assignments.id',
        'assignments.caregiver_id',
        'assignments.visit_template_id',
        'clients.id as client_id',
        'assignments.scheduled_start_time',
      )
      .first();
    if (!row) return null;
    return {
      id: row.id as string,
      caregiverId: row.caregiver_id as string,
      visitTemplateId: row.visit_template_id as string,
      clientId: row.client_id as string,
      visitDate: row.scheduled_start_time
        ? new Date(row.scheduled_start_time as string | Date).toISOString().slice(0, 10)
        : undefined,
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
      visitTemplateId: row.visit_template_id,
      visitDate: row.scheduled_start_time
        ? new Date(row.scheduled_start_time).toISOString().slice(0, 10)
        : undefined
    }));
  }

  async getAssignmentsByCaregiver(caregiverId: string, agencyId?: string): Promise<any[]> {
    // A client can have several authorization rows (different service codes,
    // renewed/overlapping date ranges). The LEFT JOIN to authorizations would
    // otherwise emit one assignment row per authorization, duplicating each
    // visit on the caregiver's schedule. DISTINCT ON collapses to a single row
    // per assignment, picking the authorization with the latest end_date
    // (matching getAssignmentForCaregiver, which uses .first() over the same
    // ordering).
    const query = this.db('assignments')
      .join('visit_templates', 'assignments.visit_template_id', 'visit_templates.id')
      .join('clients', 'visit_templates.client_id', 'clients.id')
      .leftJoin('authorizations', 'authorizations.client_id', 'clients.id')
      .where('assignments.caregiver_id', caregiverId)
      .distinctOn('assignments.id')
      .select(
        'assignments.id',
        'assignments.caregiver_id',
        'assignments.visit_template_id',
        'clients.id as client_id',
        'clients.first_name',
        'clients.last_name',
        'clients.latitude as client_latitude',
        'clients.longitude as client_longitude',
        'clients.geofence_radius_m',
        'authorizations.service_code'
      )
      // DISTINCT ON requires the leading ORDER BY column to match the distinct
      // key; end_date DESC then selects the most recent authorization per row.
      .orderBy('assignments.id')
      .orderBy('authorizations.end_date', 'desc');
    if (agencyId) query.andWhere('clients.agency_id', agencyId);
    const rows = await query;

    return rows.map(row => ({
      id: row.id,
      caregiverId: row.caregiver_id,
      visitTemplateId: row.visit_template_id,
      clientId: row.client_id,
      clientName: `${row.first_name} ${row.last_name}`,
      serviceCode: row.service_code ?? undefined,
      clientLat: row.client_latitude != null ? Number(row.client_latitude) : null,
      clientLng: row.client_longitude != null ? Number(row.client_longitude) : null,
      clientGeofenceM: row.geofence_radius_m != null ? Number(row.geofence_radius_m) : 150
    }));
  }

  async getAssignmentForCaregiver(
    assignmentId: string,
    caregiverId: string,
    agencyId?: string
  ): Promise<any | null> {
    const query = this.db('assignments')
      .join('visit_templates', 'assignments.visit_template_id', 'visit_templates.id')
      .join('clients', 'visit_templates.client_id', 'clients.id')
      .leftJoin('authorizations', 'authorizations.client_id', 'clients.id')
      .where('assignments.id', assignmentId)
      .andWhere('assignments.caregiver_id', caregiverId)
      .select(
        'assignments.id',
        'assignments.caregiver_id',
        'assignments.visit_template_id',
        'clients.id as client_id',
        'authorizations.service_code'
      )
      .orderBy('authorizations.end_date', 'desc');
    if (agencyId) query.andWhere('clients.agency_id', agencyId);
    const row = await query.first();

    if (!row) return null;

    return {
      id: row.id,
      caregiverId: row.caregiver_id,
      visitTemplateId: row.visit_template_id,
      clientId: row.client_id,
      serviceCode: row.service_code ?? undefined
    };
  }

  /**
   * Today's schedule for one caregiver, every assignment whose
   * `scheduled_start_time` falls in a 36-hour window around now (12 h back,
   * 24 h forward), joined with the client + visit template, plus an optional
   * LEFT-JOINed `evv_visits` row from earlier in the UTC day so the mobile
   * dashboard can surface "you're already clocked in" state.
   *
   * Tenant scope: enforced by joining `caregivers` and asserting
   * `caregivers.agency_id = ?`. We do NOT scope only by caregiver_id , 
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
  async getTodaysScheduleForCaregiver(
    caregiverId: string,
    agencyId: string
  ): Promise<TodayScheduleRow[]> {
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
      .leftJoin(
        this.db.raw(
          `(
            SELECT DISTINCT ON (assignment_id)
              assignment_id,
              id,
              status,
              clock_in_time,
              clock_out_time
            FROM evv_visits
            WHERE clock_in_time::date = (current_date AT TIME ZONE 'UTC')
            ORDER BY assignment_id, clock_in_time DESC
          ) as v`
        ),
        'v.assignment_id',
        'a.id'
      )
      .where('a.caregiver_id', caregiverId)
      .andWhere('cg.agency_id', agencyId)
      .andWhereRaw(
        "a.scheduled_start_time BETWEEN (now() - interval '12 hours') AND (now() + interval '24 hours')"
      )
      .orderByRaw('a.scheduled_start_time ASC NULLS LAST')
      .select(
        'a.id as assignment_id',
        'a.scheduled_start_time',
        'a.scheduled_end_time',
        'c.id as client_id',
        'c.first_name as client_first_name',
        'c.last_name as client_last_name',
        'c.address_line_1 as client_address_line_1',
        'c.city as client_city',
        'c.state as client_state',
        'c.latitude as client_latitude',
        'c.longitude as client_longitude',
        'c.geofence_radius_m as geofence_radius_m',
        'vt.id as template_id',
        'vt.name as template_name',
        // The DISTINCT-ON subquery above has already narrowed v.* to
        // today's latest visit per assignment, so we can read columns
        // directly. NULL when no visit exists today.
        'v.id as current_visit_id',
        'v.status as current_visit_status',
        'v.clock_in_time as current_clock_in_time',
        'v.clock_out_time as current_clock_out_time'
      );

    return rows.map((row): TodayScheduleRow => ({
      assignmentId: row.assignment_id,
      scheduledStartTime: toIsoOrNull(row.scheduled_start_time),
      scheduledEndTime: toIsoOrNull(row.scheduled_end_time),
      clientId: row.client_id,
      clientFirstName: row.client_first_name,
      clientLastName: row.client_last_name,
      clientAddressLine1: row.client_address_line_1 ?? null,
      clientCity: row.client_city ?? null,
      clientState: row.client_state ?? null,
      clientLatitude:
        row.client_latitude === null || row.client_latitude === undefined
          ? null
          : Number(row.client_latitude),
      clientLongitude:
        row.client_longitude === null || row.client_longitude === undefined
          ? null
          : Number(row.client_longitude),
      geofenceRadiusM:
        row.geofence_radius_m === null || row.geofence_radius_m === undefined
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

  /**
   * Forward-looking schedule for one caregiver, every assignment whose
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
  async getUpcomingScheduleForCaregiver(
    caregiverId: string,
    agencyId: string,
    daysAhead = 7
  ): Promise<TodayScheduleRow[]> {
    const rows = await this.db('assignments as a')
      .innerJoin('caregivers as cg', 'cg.id', 'a.caregiver_id')
      .innerJoin('visit_templates as vt', 'vt.id', 'a.visit_template_id')
      .innerJoin('clients as c', 'c.id', 'vt.client_id')
      .leftJoin(
        this.db.raw(
          `(
            SELECT DISTINCT ON (assignment_id)
              assignment_id,
              id,
              status,
              clock_in_time,
              clock_out_time
            FROM evv_visits
            WHERE clock_in_time::date = (current_date AT TIME ZONE 'UTC')
            ORDER BY assignment_id, clock_in_time DESC
          ) as v`
        ),
        'v.assignment_id',
        'a.id'
      )
      .where('a.caregiver_id', caregiverId)
      .andWhere('cg.agency_id', agencyId)
      .andWhereRaw(
        "a.scheduled_start_time BETWEEN date_trunc('day', now()) AND (now() + (? * interval '1 day'))",
        [daysAhead]
      )
      .orderByRaw('a.scheduled_start_time ASC NULLS LAST')
      .select(
        'a.id as assignment_id',
        'a.scheduled_start_time',
        'a.scheduled_end_time',
        'c.id as client_id',
        'c.first_name as client_first_name',
        'c.last_name as client_last_name',
        'c.address_line_1 as client_address_line_1',
        'c.city as client_city',
        'c.state as client_state',
        'c.latitude as client_latitude',
        'c.longitude as client_longitude',
        'c.geofence_radius_m as geofence_radius_m',
        'vt.id as template_id',
        'vt.name as template_name',
        'v.id as current_visit_id',
        'v.status as current_visit_status',
        'v.clock_in_time as current_clock_in_time',
        'v.clock_out_time as current_clock_out_time'
      );

    return rows.map((row): TodayScheduleRow => ({
      assignmentId: row.assignment_id,
      scheduledStartTime: toIsoOrNull(row.scheduled_start_time),
      scheduledEndTime: toIsoOrNull(row.scheduled_end_time),
      clientId: row.client_id,
      clientFirstName: row.client_first_name,
      clientLastName: row.client_last_name,
      clientAddressLine1: row.client_address_line_1 ?? null,
      clientCity: row.client_city ?? null,
      clientState: row.client_state ?? null,
      clientLatitude:
        row.client_latitude === null || row.client_latitude === undefined
          ? null
          : Number(row.client_latitude),
      clientLongitude:
        row.client_longitude === null || row.client_longitude === undefined
          ? null
          : Number(row.client_longitude),
      geofenceRadiusM:
        row.geofence_radius_m === null || row.geofence_radius_m === undefined
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

  /**
   * Tenant-scoped (via client join) template update. Only provided fields are
   * written. Returns the updated template, or null when unknown / cross-tenant.
   */
  async updateTemplate(
    templateId: string,
    agencyId: string,
    patch: { name?: string; tasks?: unknown }
  ): Promise<any | null> {
    const owned = await this.db('visit_templates')
      .join('clients', 'visit_templates.client_id', 'clients.id')
      .where('visit_templates.id', templateId)
      .andWhere('clients.agency_id', agencyId)
      .first('visit_templates.id');
    if (!owned) return null;

    const cols: Record<string, unknown> = {};
    if (patch.name !== undefined) cols.name = patch.name;
    if (patch.tasks !== undefined) cols.tasks = JSON.stringify(patch.tasks);
    if (Object.keys(cols).length > 0) {
      cols.updated_at = this.db.fn.now();
      await this.db('visit_templates').where({ id: templateId }).update(cols);
    }
    const row = await this.db('visit_templates').where({ id: templateId }).first();
    return row
      ? {
          id: row.id,
          clientId: row.client_id,
          name: row.name,
          tasks: typeof row.tasks === 'string' ? JSON.parse(row.tasks) : row.tasks
        }
      : null;
  }

  /**
   * Delete a template, tenant-scoped. Refuses ('has_dependencies') when any
   * assignment still references it. 'not_found' for unknown / cross-tenant id.
   */
  async deleteTemplate(
    templateId: string,
    agencyId: string
  ): Promise<'deleted' | 'not_found' | 'has_dependencies'> {
    const owned = await this.db('visit_templates')
      .join('clients', 'visit_templates.client_id', 'clients.id')
      .where('visit_templates.id', templateId)
      .andWhere('clients.agency_id', agencyId)
      .first('visit_templates.id');
    if (!owned) return 'not_found';
    const dep = await this.db('assignments').where({ visit_template_id: templateId }).first('id');
    if (dep) return 'has_dependencies';
    await this.db('visit_templates').where({ id: templateId }).del();
    return 'deleted';
  }

  /** True when the assignment exists and belongs to the agency (via template→client). */
  async assignmentInAgency(assignmentId: string, agencyId: string): Promise<boolean> {
    const row = await this.db('assignments')
      .join('visit_templates', 'assignments.visit_template_id', 'visit_templates.id')
      .join('clients', 'visit_templates.client_id', 'clients.id')
      .where('assignments.id', assignmentId)
      .andWhere('clients.agency_id', agencyId)
      .first('assignments.id');
    return Boolean(row);
  }

  /**
   * Tenant-scoped assignment update. Supports rescheduling (visitDate, null to
   * clear) and reassigning caregiver/template. The caller MUST validate that any
   * new caregiverId / visitTemplateId belongs to the agency first. Returns null
   * when the assignment is unknown / cross-tenant.
   */
  async updateAssignment(
    assignmentId: string,
    agencyId: string,
    patch: { caregiverId?: string; visitTemplateId?: string; visitDate?: string | null }
  ): Promise<any | null> {
    if (!(await this.assignmentInAgency(assignmentId, agencyId))) return null;

    const cols: Record<string, unknown> = {};
    if (patch.caregiverId !== undefined) cols.caregiver_id = patch.caregiverId;
    if (patch.visitTemplateId !== undefined) cols.visit_template_id = patch.visitTemplateId;
    if (patch.visitDate !== undefined) {
      cols.scheduled_start_time = patch.visitDate
        ? new Date(`${patch.visitDate}T00:00:00.000Z`).toISOString()
        : null;
    }
    if (Object.keys(cols).length > 0) {
      cols.updated_at = this.db.fn.now();
      await this.db('assignments').where({ id: assignmentId }).update(cols);
    }
    const row = await this.db('assignments').where({ id: assignmentId }).first();
    return row
      ? {
          id: row.id,
          caregiverId: row.caregiver_id,
          visitTemplateId: row.visit_template_id,
          visitDate: row.scheduled_start_time
            ? new Date(row.scheduled_start_time).toISOString().slice(0, 10)
            : undefined
        }
      : null;
  }

  /**
   * Delete (cancel) an assignment, tenant-scoped. Refuses ('has_dependencies')
   * when an EVV visit already exists for it, those carry verified clock-in/out
   * history. 'not_found' for unknown / cross-tenant id.
   */
  async deleteAssignment(
    assignmentId: string,
    agencyId: string
  ): Promise<'deleted' | 'not_found' | 'has_dependencies'> {
    if (!(await this.assignmentInAgency(assignmentId, agencyId))) return 'not_found';
    const dep = await this.db('evv_visits').where({ assignment_id: assignmentId }).first('id');
    if (dep) return 'has_dependencies';
    await this.db('assignments').where({ id: assignmentId }).del();
    return 'deleted';
  }
}
