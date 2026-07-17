import type { Knex } from 'knex';
import type { RecurringSchedule, RecurringScheduleStatus } from '../domain/recurring-schedule.js';
import { expandRecurrence } from '../services/recurrence-service.js';
import { planMaterialization } from '../services/materialization-planner.js';
import type { ConflictExistingAssignment } from '../services/schedule-conflict-service.js';

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
  /** Occurrences that already had an assignment for this caregiver + template. */
  skipped: number;
  /** Occurrences refused because they would double-book the caregiver. */
  conflicted: number;
  /** Human-readable reason per conflicted occurrence, for the coordinator. */
  conflicts: string[];
}

/** One upcoming recurring occurrence that has no assignment generated yet. */
export interface CoverageGap {
  scheduleId: string;
  caregiverName: string | null;
  clientName: string;
  templateName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface CoverageForecast {
  windowStart: string;
  windowEnd: string;
  totalGaps: number;
  gaps: CoverageGap[];
}

function toYmd(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

export class RecurringScheduleRepository {
  constructor(private readonly db: Knex) {}

  async create(agencyId: string, s: RecurringSchedule): Promise<{ id: string }> {
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
    return { id: row.id as string };
  }

  async list(agencyId: string): Promise<RecurringScheduleView[]> {
    const rows = (await this.db('recurring_schedules as rs')
      .join('visit_templates as vt', 'vt.id', 'rs.visit_template_id')
      .join('clients as c', 'c.id', 'vt.client_id')
      .leftJoin('caregivers as cg', 'cg.id', 'rs.caregiver_id')
      .where('rs.agency_id', agencyId)
      .orderBy('rs.created_at', 'desc')
      .select(
        'rs.*',
        'vt.name as template_name',
        'c.first_name as client_first',
        'c.last_name as client_last',
        'cg.first_name as cg_first',
        'cg.last_name as cg_last',
      )) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as string,
      caregiverId: r.caregiver_id as string,
      caregiverName:
        r.cg_first || r.cg_last ? `${r.cg_first ?? ''} ${r.cg_last ?? ''}`.trim() : null,
      visitTemplateId: r.visit_template_id as string,
      templateName: r.template_name as string,
      clientName: `${r.client_first ?? ''} ${r.client_last ?? ''}`.trim(),
      daysOfWeek:
        typeof r.days_of_week === 'string'
          ? (JSON.parse(r.days_of_week) as number[])
          : ((r.days_of_week as number[]) ?? []),
      startTime: r.start_time as string,
      endTime: r.end_time as string,
      startDate: toYmd(r.start_date),
      endDate: toYmd(r.end_date),
      status: r.status as RecurringScheduleStatus,
    }));
  }

  async setStatus(agencyId: string, id: string, status: RecurringScheduleStatus): Promise<boolean> {
    const n = await this.db('recurring_schedules')
      .where({ id, agency_id: agencyId })
      .update({ status, updated_at: this.db.fn.now() });
    return n > 0;
  }

  async remove(agencyId: string, id: string): Promise<boolean> {
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
   *
   * Also refuses to double-book: an occurrence whose window overlaps one the
   * caregiver already has for a *different* template is reported in
   * `conflicts` and not inserted. The date-dedup above cannot see that case ,
   * two clients with overlapping recurring patterns are different templates, so
   * every occurrence looked new. This is the only writer of real scheduled
   * windows, which is what makes overlap decidable here at all.
   */
  async materialize(
    agencyId: string,
    scheduleId: string,
    windowStart: string,
    windowEnd: string,
  ): Promise<MaterializeResult> {
    const sched = (await this.db('recurring_schedules')
      .where({ id: scheduleId, agency_id: agencyId })
      .first()) as Record<string, unknown> | undefined;
    if (!sched) throw new Error('recurring schedule not found in this agency');
    if (sched.status !== 'active') {
      return { scheduleId, created: 0, skipped: 0, conflicted: 0, conflicts: [] };
    }

    // Confirm the visit template still belongs to this agency.
    const tpl = await this.db('visit_templates as vt')
      .join('clients as c', 'c.id', 'vt.client_id')
      .where('vt.id', sched.visit_template_id as string)
      .andWhere('c.agency_id', agencyId)
      .first('vt.id');
    if (!tpl) throw new Error('visit template not found in this agency');

    const daysOfWeek =
      typeof sched.days_of_week === 'string'
        ? (JSON.parse(sched.days_of_week) as number[])
        : ((sched.days_of_week as number[]) ?? []);

    const occurrences = expandRecurrence(
      {
        daysOfWeek,
        startTime: sched.start_time as string,
        endTime: sched.end_time as string,
        startDate: toYmd(sched.start_date),
        endDate: toYmd(sched.end_date),
      },
      windowStart,
      windowEnd,
    );
    if (occurrences.length === 0) {
      return { scheduleId, created: 0, skipped: 0, conflicted: 0, conflicts: [] };
    }

    // The caregiver's whole booked window across EVERY template, not just this
    // schedule's. The same-template rows drive date dedup (below); the rest are
    // what makes cross-client double-booking visible at all.
    const existingRows = (await this.db('assignments')
      .where('caregiver_id', sched.caregiver_id as string)
      .whereNotNull('scheduled_start_time')
      .andWhere('scheduled_start_time', '>=', `${windowStart}T00:00:00.000Z`)
      .andWhere('scheduled_start_time', '<=', `${windowEnd}T23:59:59.999Z`)
      .select('visit_template_id', 'scheduled_start_time', 'scheduled_end_time')) as Array<{
      visit_template_id: string;
      scheduled_start_time: string | Date;
      scheduled_end_time: string | Date | null;
    }>;

    const booked: ConflictExistingAssignment[] = existingRows.map((r) => ({
      visitTemplateId: r.visit_template_id,
      visitDate: new Date(r.scheduled_start_time).toISOString().slice(0, 10),
      scheduledStart: new Date(r.scheduled_start_time).toISOString(),
      scheduledEnd: r.scheduled_end_time ? new Date(r.scheduled_end_time).toISOString() : undefined,
    }));

    // Decide everything up front (pure, tested), then do only I/O below.
    const plan = planMaterialization({
      visitTemplateId: sched.visit_template_id as string,
      occurrences,
      booked,
    });

    for (const o of plan.insert) {
      await this.db('assignments').insert({
        id: this.db.raw('gen_random_uuid()'),
        caregiver_id: sched.caregiver_id as string,
        visit_template_id: sched.visit_template_id as string,
        scheduled_start_time: o.startsAt,
        scheduled_end_time: o.endsAt,
        recurring_schedule_id: scheduleId,
      });
    }

    return {
      scheduleId,
      created: plan.insert.length,
      skipped: plan.skipped,
      conflicted: plan.conflicts.length,
      conflicts: plan.conflicts,
    };
  }

  /**
   * Read-only coverage forecast: a dry-run of materialization. For every ACTIVE
   * recurring schedule, expand its occurrences in [windowStart, windowEnd] and
   * return the ones that have NO assignment yet (same caregiver + template) , 
   * i.e. upcoming visits that exist on paper but were never generated, so they'd
   * silently not happen. Same dedup logic as `materialize`, but inserts nothing.
   * Ordered by date so the soonest gap surfaces first.
   */
  async forecastCoverage(
    agencyId: string,
    windowStart: string,
    windowEnd: string,
  ): Promise<CoverageForecast> {
    const scheds = (await this.db('recurring_schedules as rs')
      .join('visit_templates as vt', 'vt.id', 'rs.visit_template_id')
      .join('clients as c', 'c.id', 'vt.client_id')
      .leftJoin('caregivers as cg', 'cg.id', 'rs.caregiver_id')
      .where('rs.agency_id', agencyId)
      .andWhere('rs.status', 'active')
      .select(
        'rs.id',
        'rs.caregiver_id',
        'rs.visit_template_id',
        'rs.days_of_week',
        'rs.start_time',
        'rs.end_time',
        'rs.start_date',
        'rs.end_date',
        'vt.name as template_name',
        'c.first_name as client_first',
        'c.last_name as client_last',
        'cg.first_name as cg_first',
        'cg.last_name as cg_last',
      )) as Array<Record<string, unknown>>;

    const gaps: CoverageGap[] = [];

    for (const s of scheds) {
      const daysOfWeek =
        typeof s.days_of_week === 'string'
          ? (JSON.parse(s.days_of_week) as number[])
          : ((s.days_of_week as number[]) ?? []);

      const occurrences = expandRecurrence(
        {
          daysOfWeek,
          startTime: s.start_time as string,
          endTime: s.end_time as string,
          startDate: toYmd(s.start_date),
          endDate: toYmd(s.end_date),
        },
        windowStart,
        windowEnd,
      );
      if (occurrences.length === 0) continue;

      const existingRows = (await this.db('assignments')
        .where('caregiver_id', s.caregiver_id as string)
        .andWhere('visit_template_id', s.visit_template_id as string)
        .whereNotNull('scheduled_start_time')
        .andWhere('scheduled_start_time', '>=', `${windowStart}T00:00:00.000Z`)
        .andWhere('scheduled_start_time', '<=', `${windowEnd}T23:59:59.999Z`)
        .select('scheduled_start_time')) as Array<{ scheduled_start_time: string | Date }>;
      const existingDates = new Set(
        existingRows.map((r) => new Date(r.scheduled_start_time).toISOString().slice(0, 10)),
      );

      const caregiverName =
        s.cg_first || s.cg_last ? `${s.cg_first ?? ''} ${s.cg_last ?? ''}`.trim() : null;
      const clientName = `${s.client_first ?? ''} ${s.client_last ?? ''}`.trim();

      for (const o of occurrences) {
        if (existingDates.has(o.date)) continue;
        gaps.push({
          scheduleId: s.id as string,
          caregiverName,
          clientName,
          templateName: s.template_name as string,
          date: o.date,
          startTime: o.startTime,
          endTime: o.endTime,
        });
      }
    }

    gaps.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    return { windowStart, windowEnd, totalGaps: gaps.length, gaps };
  }

  /** Materialize every active schedule in the agency. */
  async materializeAllActive(
    agencyId: string,
    windowStart: string,
    windowEnd: string,
  ): Promise<MaterializeResult[]> {
    const ids = (await this.db('recurring_schedules')
      .where({ agency_id: agencyId, status: 'active' })
      .select('id')) as Array<{ id: string }>;
    const results: MaterializeResult[] = [];
    for (const { id } of ids) {
      results.push(await this.materialize(agencyId, id, windowStart, windowEnd));
    }
    return results;
  }
}
