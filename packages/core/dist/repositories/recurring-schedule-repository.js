import { expandRecurrence } from '../services/recurrence-service.js';
function toYmd(v) {
    if (v instanceof Date)
        return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
}
export class RecurringScheduleRepository {
    constructor(db) {
        this.db = db;
    }
    async create(agencyId, s) {
        const [row] = await this.db('recurring_schedules')
            .insert({
            id: this.db.raw('gen_random_uuid()'),
            agency_id: agencyId,
            caregiver_id: s.caregiverId,
            visit_template_id: s.visitTemplateId,
            days_of_week: JSON.stringify(s.daysOfWeek),
            start_time: s.startTime,
            end_time: s.endTime,
            start_date: s.startDate,
            end_date: s.endDate,
            status: s.status ?? 'active',
        })
            .returning('id');
        return { id: row.id };
    }
    async list(agencyId) {
        const rows = (await this.db('recurring_schedules as rs')
            .join('visit_templates as vt', 'vt.id', 'rs.visit_template_id')
            .join('clients as c', 'c.id', 'vt.client_id')
            .leftJoin('caregivers as cg', 'cg.id', 'rs.caregiver_id')
            .where('rs.agency_id', agencyId)
            .orderBy('rs.created_at', 'desc')
            .select('rs.*', 'vt.name as template_name', 'c.first_name as client_first', 'c.last_name as client_last', 'cg.first_name as cg_first', 'cg.last_name as cg_last'));
        return rows.map((r) => ({
            id: r.id,
            caregiverId: r.caregiver_id,
            caregiverName: r.cg_first || r.cg_last ? `${r.cg_first ?? ''} ${r.cg_last ?? ''}`.trim() : null,
            visitTemplateId: r.visit_template_id,
            templateName: r.template_name,
            clientName: `${r.client_first ?? ''} ${r.client_last ?? ''}`.trim(),
            daysOfWeek: typeof r.days_of_week === 'string'
                ? JSON.parse(r.days_of_week)
                : (r.days_of_week ?? []),
            startTime: r.start_time,
            endTime: r.end_time,
            startDate: toYmd(r.start_date),
            endDate: toYmd(r.end_date),
            status: r.status,
        }));
    }
    async setStatus(agencyId, id, status) {
        const n = await this.db('recurring_schedules')
            .where({ id, agency_id: agencyId })
            .update({ status, updated_at: this.db.fn.now() });
        return n > 0;
    }
    async remove(agencyId, id) {
        const n = await this.db('recurring_schedules').where({ id, agency_id: agencyId }).del();
        return n > 0;
    }
    /**
     * Materialize one recurring schedule into concrete `assignments` for the
     * [windowStart, windowEnd] window. Idempotent: an occurrence date that
     * already has an assignment for the same caregiver + visit template (whether
     * from a prior run or a manual booking) is skipped, never duplicated. Paused
     * / ended schedules generate nothing. Throws if the schedule or its template
     * isn't in the agency.
     */
    async materialize(agencyId, scheduleId, windowStart, windowEnd) {
        const sched = (await this.db('recurring_schedules')
            .where({ id: scheduleId, agency_id: agencyId })
            .first());
        if (!sched)
            throw new Error('recurring schedule not found in this agency');
        if (sched.status !== 'active')
            return { scheduleId, created: 0, skipped: 0 };
        // Confirm the visit template still belongs to this agency.
        const tpl = await this.db('visit_templates as vt')
            .join('clients as c', 'c.id', 'vt.client_id')
            .where('vt.id', sched.visit_template_id)
            .andWhere('c.agency_id', agencyId)
            .first('vt.id');
        if (!tpl)
            throw new Error('visit template not found in this agency');
        const daysOfWeek = typeof sched.days_of_week === 'string'
            ? JSON.parse(sched.days_of_week)
            : (sched.days_of_week ?? []);
        const occurrences = expandRecurrence({
            daysOfWeek,
            startTime: sched.start_time,
            endTime: sched.end_time,
            startDate: toYmd(sched.start_date),
            endDate: toYmd(sched.end_date),
        }, windowStart, windowEnd);
        if (occurrences.length === 0)
            return { scheduleId, created: 0, skipped: 0 };
        // Existing assignment dates for this caregiver + template across the window
        // — dedup against both prior materializations and manual bookings.
        const existingRows = (await this.db('assignments')
            .where('caregiver_id', sched.caregiver_id)
            .andWhere('visit_template_id', sched.visit_template_id)
            .whereNotNull('scheduled_start_time')
            .andWhere('scheduled_start_time', '>=', `${windowStart}T00:00:00.000Z`)
            .andWhere('scheduled_start_time', '<=', `${windowEnd}T23:59:59.999Z`)
            .select('scheduled_start_time'));
        const existingDates = new Set(existingRows.map((r) => new Date(r.scheduled_start_time).toISOString().slice(0, 10)));
        let created = 0;
        let skipped = 0;
        for (const o of occurrences) {
            if (existingDates.has(o.date)) {
                skipped += 1;
                continue;
            }
            await this.db('assignments').insert({
                id: this.db.raw('gen_random_uuid()'),
                caregiver_id: sched.caregiver_id,
                visit_template_id: sched.visit_template_id,
                scheduled_start_time: o.startsAt,
                scheduled_end_time: o.endsAt,
                recurring_schedule_id: scheduleId,
            });
            existingDates.add(o.date);
            created += 1;
        }
        return { scheduleId, created, skipped };
    }
    /** Materialize every active schedule in the agency. */
    async materializeAllActive(agencyId, windowStart, windowEnd) {
        const ids = (await this.db('recurring_schedules')
            .where({ agency_id: agencyId, status: 'active' })
            .select('id'));
        const results = [];
        for (const { id } of ids) {
            results.push(await this.materialize(agencyId, id, windowStart, windowEnd));
        }
        return results;
    }
}
//# sourceMappingURL=recurring-schedule-repository.js.map