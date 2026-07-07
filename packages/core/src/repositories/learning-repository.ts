import type { Knex } from 'knex';
import type {
  AssignmentComplianceCheck,
  CaregiverLearningProgress,
  CourseAnalyticsEnvelope,
  CourseAnalyticsRow,
  CourseCaregiverEnvelope,
  CourseCompletion,
  CourseEnrollment,
  EnrollmentStatus,
  InsightCaregiver,
  LearningAgencyRollup,
  LearningCertificate,
  LearningCourse,
  LearningInsightsEnvelope,
  NewCourseCompletion,
  NewCourseEnrollment,
  NewLearningCourse,
} from '../domain/learning.js';

type InsightContext = 'due' | 'expired' | 'orientation' | 'stalled' | 'cert_expiring';

interface InsightRow {
  enrollment_id: string;
  caregiver_id: string;
  first_name: string;
  last_name: string;
  course_title: string;
  course_code: string;
  due_at: string | null;
  expires_at: string | null;
  assigned_at: string;
}

export class LearningRepository {
  constructor(private readonly db: Knex) {}

  // ---------- Courses ----------

  async listCourses(agencyId: string): Promise<LearningCourse[]> {
    const rows = await this.db('learning_courses')
      .where((q: Knex.QueryBuilder) => q.where('agency_id', agencyId).orWhereNull('agency_id'))
      .orderBy('required', 'desc')
      .orderBy('title', 'asc');
    return rows.map((r: Record<string, unknown>) => this.mapCourse(r));
  }

  async findCourseById(id: string): Promise<LearningCourse | undefined> {
    const row = await this.db('learning_courses').where({ id }).first();
    return row ? this.mapCourse(row as Record<string, unknown>) : undefined;
  }

  async findCourseByCode(agencyId: string | null, code: string): Promise<LearningCourse | undefined> {
    const query = this.db('learning_courses').where({ code });
    if (agencyId === null) {
      query.whereNull('agency_id');
    } else {
      query.where('agency_id', agencyId);
    }
    const row = await query.first();
    return row ? this.mapCourse(row as Record<string, unknown>) : undefined;
  }

  async createCourse(data: NewLearningCourse): Promise<LearningCourse> {
    const [row] = await this.db('learning_courses')
      .insert({
        agency_id: data.agencyId,
        code: data.code,
        title: data.title,
        description: data.description,
        cadence: data.cadence,
        expires_after_days: data.expiresAfterDays,
        required: data.required,
        duration_minutes: data.durationMinutes,
        external_url: data.externalUrl ?? null,
        modules: data.modules ? JSON.stringify(data.modules) : null,
      })
      .returning('*');
    return this.mapCourse(row as Record<string, unknown>);
  }

  /**
   * Updates an agency-owned course. Global courses (agency_id NULL) are not
   * editable by agencies, so the WHERE clause scopes to the agency's own rows;
   * an attempt to edit a global or other-agency course matches nothing and
   * returns undefined.
   */
  async updateCourse(
    id: string,
    agencyId: string,
    data: Partial<NewLearningCourse>,
  ): Promise<LearningCourse | undefined> {
    const patch: Record<string, unknown> = { updated_at: this.db.fn.now() };
    if (data.code !== undefined) patch.code = data.code;
    if (data.title !== undefined) patch.title = data.title;
    if (data.description !== undefined) patch.description = data.description;
    if (data.cadence !== undefined) patch.cadence = data.cadence;
    if (data.expiresAfterDays !== undefined) patch.expires_after_days = data.expiresAfterDays;
    if (data.required !== undefined) patch.required = data.required;
    if (data.durationMinutes !== undefined) patch.duration_minutes = data.durationMinutes;
    if (data.externalUrl !== undefined) patch.external_url = data.externalUrl ?? null;
    if (data.modules !== undefined) patch.modules = data.modules ? JSON.stringify(data.modules) : null;

    const [row] = await this.db('learning_courses')
      .where({ id, agency_id: agencyId })
      .update(patch)
      .returning('*');
    return row ? this.mapCourse(row as Record<string, unknown>) : undefined;
  }

  /**
   * Deletes an agency-owned course. Scoped to the agency's own rows so a global
   * or other-agency course cannot be removed. Returns true if a row was deleted.
   * Enrollments/completions cascade-delete via FK ON DELETE CASCADE.
   */
  async deleteCourse(id: string, agencyId: string): Promise<boolean> {
    const deleted = await this.db('learning_courses').where({ id, agency_id: agencyId }).del();
    return deleted > 0;
  }

  /** Idempotent upsert by (agency_id, code). Used by the catalog seed script. */
  async upsertCourseByCode(data: NewLearningCourse): Promise<LearningCourse> {
    const existing = await this.findCourseByCode(data.agencyId, data.code);
    if (existing) return existing;
    return this.createCourse(data);
  }

  // ---------- Enrollments ----------

  async listEnrollmentsForCaregiver(caregiverId: string): Promise<CourseEnrollment[]> {
    const rows = await this.db('course_enrollments')
      .where({ caregiver_id: caregiverId })
      .orderBy('assigned_at', 'desc');
    return rows.map((r: Record<string, unknown>) => this.mapEnrollment(r));
  }

  /**
   * Look up an enrollment by (caregiver, course). Always scoped by `agencyId`
   * so it can never return, or dedup against, another tenant's enrollment row.
   */
  async findEnrollment(
    caregiverId: string,
    courseId: string,
    agencyId: string,
  ): Promise<CourseEnrollment | undefined> {
    const row = await this.db('course_enrollments')
      .where({ caregiver_id: caregiverId, course_id: courseId, agency_id: agencyId })
      .first();
    return row ? this.mapEnrollment(row as Record<string, unknown>) : undefined;
  }

  /**
   * Mark an enrollment in-progress. Scoped by `agencyId` so a caller can only
   * transition enrollments owned by their own agency. Returns true when a row
   * was updated, false when the enrollment doesn't exist in this agency (or
   * wasn't in a startable state) so the route can 404 rather than silently no-op.
   */
  async markInProgress(enrollmentId: string, agencyId: string): Promise<boolean> {
    const updated = await this.db('course_enrollments')
      .where({ id: enrollmentId, agency_id: agencyId })
      .whereIn('status', ['not_started', 'overdue'])
      .update({ status: 'in_progress', updated_at: this.db.fn.now() });
    return updated > 0;
  }

  async enroll(data: NewCourseEnrollment): Promise<CourseEnrollment> {
    // The caregiver must belong to the enrolling agency, prevents creating an
    // enrollment row that points at another tenant's caregiver.
    const caregiver = await this.db('caregivers')
      .where({ id: data.caregiverId, agency_id: data.agencyId })
      .first('id');
    if (!caregiver) {
      throw new Error('Caregiver not found in this agency');
    }
    const existing = await this.findEnrollment(data.caregiverId, data.courseId, data.agencyId);
    if (existing) return existing;
    const [row] = await this.db('course_enrollments')
      .insert({
        agency_id: data.agencyId,
        caregiver_id: data.caregiverId,
        course_id: data.courseId,
        due_at: data.dueAt,
        status: 'not_started',
      })
      .returning('*');
    return this.mapEnrollment(row as Record<string, unknown>);
  }

  // ---------- Completions ----------

  async recordCompletion(data: NewCourseCompletion, agencyId: string): Promise<CourseCompletion> {
    return this.db.transaction(async (trx) => {
      // Scope the enrollment lookup by agency so a caller can only complete an
      // enrollment owned by their own agency, the enrollment id alone is not a
      // sufficient authorization token.
      const enrollment = await trx('course_enrollments')
        .where({ id: data.enrollmentId, agency_id: agencyId })
        .first();
      if (!enrollment) throw new Error(`Enrollment ${data.enrollmentId} not found`);

      const course = await trx('learning_courses').where({ id: data.courseId }).first();
      if (!course) throw new Error(`Course ${data.courseId} not found`);

      const [completionRow] = await trx('course_completions')
        .insert({
          enrollment_id: data.enrollmentId,
          caregiver_id: data.caregiverId,
          course_id: data.courseId,
          completed_at: data.completedAt,
          score: data.score,
          notes: data.notes,
        })
        .returning('*');

      const expiresAfterDays = (course as Record<string, unknown>).expires_after_days as number | null;
      const expiresAt =
        expiresAfterDays && expiresAfterDays > 0
          ? new Date(new Date(data.completedAt).getTime() + expiresAfterDays * 86400000).toISOString()
          : null;

      await trx('course_enrollments').where({ id: data.enrollmentId }).update({
        last_completed_at: data.completedAt,
        expires_at: expiresAt,
        status: 'completed',
        updated_at: trx.fn.now(),
      });

      return this.mapCompletion(completionRow as Record<string, unknown>);
    });
  }

  // ---------- Aggregate queries ----------

  async getAgencyRollup(agencyId: string, now = new Date()): Promise<LearningAgencyRollup> {
    const nowIso = now.toISOString();

    const caregiversRow = await this.db('caregivers')
      .where({ agency_id: agencyId, status: 'active' })
      .count('id as total')
      .first();
    const totalCaregivers = Number(caregiversRow?.total ?? 0);

    const enrollments = await this.db('course_enrollments')
      .where({ agency_id: agencyId })
      .select('status', 'last_completed_at', 'expires_at', 'due_at');

    const counts = { not_started: 0, in_progress: 0, completed: 0, overdue: 0, expired: 0 };
    for (const e of enrollments as Record<string, unknown>[]) {
      const status = this.deriveStatus(
        e.status as string,
        e.last_completed_at ? this.toIsoString(e.last_completed_at) : null,
        e.expires_at ? this.toIsoString(e.expires_at) : null,
        e.due_at ? this.toIsoString(e.due_at) : null,
        nowIso,
      );
      counts[status] += 1;
    }

    const totalEnrollments = enrollments.length;
    const required =
      counts.completed + counts.overdue + counts.expired + counts.not_started + counts.in_progress;
    const complianceRate = required > 0 ? counts.completed / required : 1;

    return {
      totalCaregivers,
      totalEnrollments,
      notStarted: counts.not_started,
      inProgress: counts.in_progress,
      completed: counts.completed,
      overdue: counts.overdue,
      expired: counts.expired,
      complianceRate,
    };
  }

  async getCaregiverProgress(caregiverId: string, now = new Date()): Promise<CaregiverLearningProgress> {
    const nowIso = now.toISOString();
    const rows = await this.db('course_enrollments as e')
      .join('learning_courses as c', 'c.id', 'e.course_id')
      .where('e.caregiver_id', caregiverId)
      .select('e.*', this.db.raw('row_to_json(c.*) as course_json'));

    let allCompliant = true;
    const items = rows.map((row: Record<string, unknown>) => {
      const enrollment = this.mapEnrollment(row);
      const course = this.mapCourse(row.course_json as Record<string, unknown>);
      const effective = this.deriveStatus(
        enrollment.status,
        enrollment.lastCompletedAt,
        enrollment.expiresAt,
        enrollment.dueAt,
        nowIso,
      );
      if (course.required && effective !== 'completed') allCompliant = false;
      return { enrollment: { ...enrollment, status: effective }, course };
    });

    return { caregiverId, enrollments: items, isCompliant: allCompliant };
  }

  async getCourseAnalytics(agencyId: string, now = new Date()): Promise<CourseAnalyticsEnvelope> {
    const nowIso = now.toISOString();
    const rows = await this.db('learning_courses as c')
      .leftJoin('course_enrollments as e', (join: Knex.JoinClause) => {
        join.on('e.course_id', '=', 'c.id').andOnVal('e.agency_id', agencyId);
      })
      .where((q: Knex.QueryBuilder) => q.where('c.agency_id', agencyId).orWhereNull('c.agency_id'))
      .select(
        'c.id as course_id',
        'c.code as course_code',
        'c.title as course_title',
        'c.required',
        'c.cadence',
        'e.id as enrollment_id',
        'e.assigned_at',
        'e.last_completed_at',
        'e.expires_at',
        'e.due_at',
        'e.status as stored_status',
      );

    const byCourse = new Map<string, { course: Record<string, unknown>; rows: Record<string, unknown>[] }>();
    for (const r of rows as Record<string, unknown>[]) {
      const courseId = r.course_id as string;
      const existing = byCourse.get(courseId);
      if (!existing) {
        byCourse.set(courseId, { course: r, rows: r.enrollment_id ? [r] : [] });
      } else if (r.enrollment_id) {
        existing.rows.push(r);
      }
    }

    const analyticsRows: CourseAnalyticsRow[] = [];
    for (const { course, rows: enrollmentRows } of byCourse.values()) {
      let completed = 0, overdue = 0, expired = 0, pending = 0;
      let timeToCompleteSumDays = 0, timeToCompleteCount = 0;

      for (const r of enrollmentRows) {
        const effective = this.deriveStatus(
          (r.stored_status as string) ?? 'not_started',
          r.last_completed_at ? this.toIsoString(r.last_completed_at) : null,
          r.expires_at ? this.toIsoString(r.expires_at) : null,
          r.due_at ? this.toIsoString(r.due_at) : null,
          nowIso,
        );
        switch (effective) {
          case 'completed': completed++; break;
          case 'overdue': overdue++; break;
          case 'expired': expired++; break;
          default: pending++;
        }
        if (r.last_completed_at && r.assigned_at) {
          const diffMs =
            new Date(this.toIsoString(r.last_completed_at)).getTime() -
            new Date(this.toIsoString(r.assigned_at)).getTime();
          if (diffMs > 0) { timeToCompleteSumDays += diffMs / 86400000; timeToCompleteCount++; }
        }
      }

      const total = completed + overdue + expired + pending;
      analyticsRows.push({
        courseId: course.course_id as string,
        courseCode: course.course_code as string,
        courseTitle: course.course_title as string,
        required: Boolean(course.required),
        cadence: course.cadence as CourseAnalyticsRow['cadence'],
        totalEnrollments: total,
        completedCount: completed,
        overdueCount: overdue,
        expiredCount: expired,
        pendingCount: pending,
        completionRate: total > 0 ? completed / total : 0,
        averageDaysToComplete: timeToCompleteCount > 0 ? timeToCompleteSumDays / timeToCompleteCount : null,
      });
    }

    analyticsRows.sort((a, b) => {
      if (a.required !== b.required) return a.required ? -1 : 1;
      return a.completionRate - b.completionRate;
    });

    return { generatedAt: nowIso, rows: analyticsRows };
  }

  async getCourseCaregivers(
    courseId: string,
    agencyId: string,
    now = new Date(),
  ): Promise<CourseCaregiverEnvelope | undefined> {
    const course = await this.findCourseById(courseId);
    if (!course) return undefined;

    const rows = await this.db('course_enrollments as e')
      .join('caregivers as cg', 'cg.id', 'e.caregiver_id')
      .where('e.course_id', courseId)
      .where('e.agency_id', agencyId)
      .select(
        'e.id as enrollment_id',
        'e.agency_id',
        'e.caregiver_id',
        'e.course_id',
        'e.assigned_at',
        'e.due_at',
        'e.last_completed_at',
        'e.expires_at',
        'e.status',
        'cg.first_name',
        'cg.last_name',
        'cg.email',
      )
      .orderBy('cg.last_name', 'asc');

    const nowIso = now.toISOString();
    const caregivers = rows.map((r: Record<string, unknown>) => {
      const enrollment = this.mapEnrollment({
        id: r.enrollment_id,
        agency_id: r.agency_id,
        caregiver_id: r.caregiver_id,
        course_id: r.course_id,
        assigned_at: r.assigned_at,
        due_at: r.due_at,
        last_completed_at: r.last_completed_at,
        expires_at: r.expires_at,
        status: r.status,
      });
      const effective = this.deriveStatus(
        enrollment.status,
        enrollment.lastCompletedAt,
        enrollment.expiresAt,
        enrollment.dueAt,
        nowIso,
      );
      return {
        enrollment: { ...enrollment, status: effective },
        caregiver: {
          id: String(r.caregiver_id),
          firstName: String(r.first_name),
          lastName: String(r.last_name),
          email: String(r.email),
        },
        effectiveStatus: effective,
      };
    });

    return { course, caregivers };
  }

  /**
   * Assembles certificate-of-completion data for a caregiver's completed course.
   * Returns undefined if the caregiver has no completed enrollment for the
   * course (so the route can 404 rather than mint a certificate for incomplete
   * training). The verification code is derived from the enrollment id.
   */
  async getCertificate(courseId: string, caregiverId: string): Promise<LearningCertificate | undefined> {
    const row = await this.db('course_enrollments as e')
      .join('caregivers as cg', 'cg.id', 'e.caregiver_id')
      .join('learning_courses as c', 'c.id', 'e.course_id')
      .join('agencies as a', 'a.id', 'e.agency_id')
      .where('e.course_id', courseId)
      .where('e.caregiver_id', caregiverId)
      .whereNotNull('e.last_completed_at')
      .first(
        'e.id as enrollment_id',
        'e.last_completed_at',
        'e.expires_at',
        'cg.first_name',
        'cg.last_name',
        'c.title as course_title',
        'c.code as course_code',
        'c.cadence',
        'a.name as agency_name',
      );
    if (!row) return undefined;

    const r = row as Record<string, unknown>;
    const enrollmentId = String(r.enrollment_id);
    const completion = await this.db('course_completions')
      .where({ enrollment_id: enrollmentId })
      .orderBy('completed_at', 'desc')
      .first('score');
    const score = completion && (completion as Record<string, unknown>).score != null
      ? Number((completion as Record<string, unknown>).score)
      : null;

    return {
      caregiverName: `${String(r.first_name ?? '').trim()} ${String(r.last_name ?? '').trim()}`.trim(),
      agencyName: String(r.agency_name ?? ''),
      courseTitle: String(r.course_title ?? ''),
      courseCode: String(r.course_code ?? ''),
      cadence: r.cadence as LearningCertificate['cadence'],
      completedAt: this.toIsoString(r.last_completed_at),
      expiresAt: r.expires_at ? this.toIsoString(r.expires_at) : null,
      score,
      verificationCode: `RH-${enrollmentId.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
    };
  }

  async getAssignmentBlockers(caregiverId: string, now = new Date()): Promise<AssignmentComplianceCheck> {
    const nowIso = now.toISOString();
    const rows = await this.db('course_enrollments as e')
      .join('learning_courses as c', 'c.id', 'e.course_id')
      .where('e.caregiver_id', caregiverId)
      .where('c.required', true)
      .select(
        'e.id as enrollment_id',
        'e.status',
        'e.last_completed_at',
        'e.expires_at',
        'e.due_at',
        'c.code as course_code',
        'c.title as course_title',
      );

    const blockers = [];
    for (const r of rows as Record<string, unknown>[]) {
      const effectiveStatus = this.deriveStatus(
        r.status as string,
        r.last_completed_at ? this.toIsoString(r.last_completed_at) : null,
        r.expires_at ? this.toIsoString(r.expires_at) : null,
        r.due_at ? this.toIsoString(r.due_at) : null,
        nowIso,
      );
      if (effectiveStatus === 'completed') continue;
      blockers.push({
        enrollmentId: r.enrollment_id as string,
        courseCode: r.course_code as string,
        courseTitle: r.course_title as string,
        status: effectiveStatus,
        reason:
          effectiveStatus === 'expired'
            ? `${r.course_title} expired, recertify before scheduling`
            : effectiveStatus === 'overdue'
            ? `${r.course_title} is overdue`
            : `${r.course_title} not yet completed`,
      });
    }

    return { compliant: blockers.length === 0, blockers };
  }

  async getActionableInsights(agencyId: string, now = new Date()): Promise<LearningInsightsEnvelope> {
    const nowIso = now.toISOString();
    const in7DaysIso = new Date(now.getTime() + 7 * 86400000).toISOString();
    const in60DaysIso = new Date(now.getTime() + 60 * 86400000).toISOString();
    const ago30DaysIso = new Date(now.getTime() - 30 * 86400000).toISOString();

    const insights = [];

    const dueSoon = await this.fetchInsightRows(agencyId, (q) =>
      q.where('c.required', true).whereNotNull('e.due_at')
        .where('e.due_at', '>=', nowIso).where('e.due_at', '<=', in7DaysIso)
        .whereNull('e.last_completed_at'),
    );
    if (dueSoon.length > 0) {
      insights.push({
        kind: 'due_in_7_days' as const,
        severity: 'warning' as const,
        title: `${dueSoon.length} caregiver${dueSoon.length === 1 ? '' : 's'} due for training this week`,
        summary: "Required training due in the next 7 days. Send a reminder before the due date passes.",
        actionLabel: 'Review caregivers',
        caregivers: dueSoon.slice(0, 10).map((r) => this.toInsightCaregiver(r, 'due')),
        totalCount: dueSoon.length,
      });
    }

    const recentlyExpired = await this.fetchInsightRows(agencyId, (q) =>
      q.where('c.required', true).whereNotNull('e.expires_at')
        .where('e.expires_at', '>=', ago30DaysIso).where('e.expires_at', '<', nowIso),
    );
    if (recentlyExpired.length > 0) {
      insights.push({
        kind: 'expired_recently' as const,
        severity: 'critical' as const,
        title: `${recentlyExpired.length} required certification${recentlyExpired.length === 1 ? '' : 's'} expired`,
        summary: 'Required training expired in the last 30 days. Block these caregivers until recertified.',
        actionLabel: 'Open caregivers',
        caregivers: recentlyExpired.slice(0, 10).map((r) => this.toInsightCaregiver(r, 'expired')),
        totalCount: recentlyExpired.length,
      });
    }

    const orientationIncomplete = await this.fetchInsightRows(agencyId, (q) =>
      q.where('c.code', 'like', 'ORIENT-%').whereNull('e.last_completed_at'),
    );
    if (orientationIncomplete.length > 0) {
      insights.push({
        kind: 'orientation_incomplete' as const,
        severity: 'critical' as const,
        title: `${orientationIncomplete.length} caregiver${orientationIncomplete.length === 1 ? '' : 's'} pending orientation`,
        summary: 'Per PA Code §52.18, orientation must be complete before first client contact.',
        actionLabel: 'Open caregivers',
        caregivers: orientationIncomplete.slice(0, 10).map((r) => this.toInsightCaregiver(r, 'orientation')),
        totalCount: orientationIncomplete.length,
      });
    }

    const stalled = await this.fetchInsightRows(agencyId, (q) =>
      q.whereNull('e.last_completed_at').whereNull('e.due_at').where('e.assigned_at', '<', ago30DaysIso),
    );
    if (stalled.length > 0) {
      insights.push({
        kind: 'stalled_enrollment' as const,
        severity: 'info' as const,
        title: `${stalled.length} stalled enrollment${stalled.length === 1 ? '' : 's'}`,
        summary: 'Enrollments assigned more than 30 days ago with no completion and no due date set.',
        actionLabel: 'Set due dates',
        caregivers: stalled.slice(0, 10).map((r) => this.toInsightCaregiver(r, 'stalled')),
        totalCount: stalled.length,
      });
    }

    const certExpiringSoon = await this.fetchInsightRows(agencyId, (q) =>
      q.where('c.cadence', 'certification').whereNotNull('e.expires_at')
        .where('e.expires_at', '>=', nowIso).where('e.expires_at', '<=', in60DaysIso),
    );
    if (certExpiringSoon.length > 0) {
      insights.push({
        kind: 'certification_expiring_soon' as const,
        severity: 'warning' as const,
        title: `${certExpiringSoon.length} certification${certExpiringSoon.length === 1 ? '' : 's'} expiring in 60 days`,
        summary: 'External certifications approaching expiry. Schedule recertification now.',
        actionLabel: 'Review caregivers',
        caregivers: certExpiringSoon.slice(0, 10).map((r) => this.toInsightCaregiver(r, 'cert_expiring')),
        totalCount: certExpiringSoon.length,
      });
    }

    return { generatedAt: nowIso, insights };
  }

  private async fetchInsightRows(
    agencyId: string,
    apply: (q: Knex.QueryBuilder) => Knex.QueryBuilder,
  ): Promise<InsightRow[]> {
    const base = this.db('course_enrollments as e')
      .join('learning_courses as c', 'c.id', 'e.course_id')
      .join('caregivers as cg', 'cg.id', 'e.caregiver_id')
      .where('e.agency_id', agencyId)
      .where('cg.status', 'active')
      .select(
        'e.id as enrollment_id', 'e.caregiver_id', 'e.due_at', 'e.expires_at',
        'e.assigned_at', 'e.last_completed_at', 'cg.first_name', 'cg.last_name',
        'c.title as course_title', 'c.code as course_code',
      )
      .orderBy('e.due_at', 'asc')
      .limit(50);

    const rows = await apply(base);
    return rows.map((r: Record<string, unknown>) => ({
      enrollment_id: String(r.enrollment_id),
      caregiver_id: String(r.caregiver_id),
      first_name: String(r.first_name),
      last_name: String(r.last_name),
      course_title: String(r.course_title),
      course_code: String(r.course_code),
      due_at: r.due_at ? this.toIsoString(r.due_at) : null,
      expires_at: r.expires_at ? this.toIsoString(r.expires_at) : null,
      assigned_at: this.toIsoString(r.assigned_at),
    }));
  }

  private toInsightCaregiver(row: InsightRow, context: InsightContext): InsightCaregiver {
    const contextStr = (() => {
      switch (context) {
        case 'due': return row.due_at ? `${row.course_code} due ${this.formatRelative(row.due_at)}` : `${row.course_code} due soon`;
        case 'expired': return row.expires_at ? `${row.course_code} expired ${this.formatRelative(row.expires_at)}` : `${row.course_code} expired`;
        case 'orientation': return 'Orientation not yet completed';
        case 'stalled': return `Assigned ${this.formatRelative(row.assigned_at)}, no progress`;
        case 'cert_expiring': return row.expires_at ? `${row.course_code} expires ${this.formatRelative(row.expires_at)}` : `${row.course_code} expires soon`;
      }
    })();
    return { caregiverId: row.caregiver_id, firstName: row.first_name, lastName: row.last_name, context: contextStr };
  }

  private formatRelative(iso: string): string {
    const diffDays = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
    if (diffDays === 0) return 'today';
    if (diffDays > 0) return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
    const days = Math.abs(diffDays);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  private deriveStatus(
    storedStatus: string,
    lastCompletedAt: string | null,
    expiresAt: string | null,
    dueAt: string | null,
    nowIso: string,
  ): EnrollmentStatus {
    if (lastCompletedAt && expiresAt && expiresAt < nowIso) return 'expired';
    if (lastCompletedAt && (!expiresAt || expiresAt >= nowIso)) return 'completed';
    if (!lastCompletedAt && dueAt && dueAt < nowIso) return 'overdue';
    if (storedStatus === 'in_progress') return 'in_progress';
    return 'not_started';
  }

  private mapCourse(row: Record<string, unknown>): LearningCourse {
    return {
      id: String(row.id),
      agencyId: row.agency_id ? String(row.agency_id) : null,
      code: String(row.code),
      title: String(row.title),
      description: String(row.description ?? ''),
      cadence: row.cadence as LearningCourse['cadence'],
      expiresAfterDays: row.expires_after_days != null ? Number(row.expires_after_days) : null,
      required: Boolean(row.required),
      durationMinutes: Number(row.duration_minutes ?? 0),
      externalUrl: row.external_url ? String(row.external_url) : null,
      modules: row.modules
        ? (typeof row.modules === 'string' ? JSON.parse(row.modules) : row.modules) as LearningCourse['modules']
        : null,
      createdAt: this.toIsoString(row.created_at),
    };
  }

  private mapEnrollment(row: Record<string, unknown>): CourseEnrollment {
    return {
      id: String(row.id),
      agencyId: String(row.agency_id),
      caregiverId: String(row.caregiver_id),
      courseId: String(row.course_id),
      assignedAt: this.toIsoString(row.assigned_at),
      dueAt: row.due_at ? this.toIsoString(row.due_at) : null,
      lastCompletedAt: row.last_completed_at ? this.toIsoString(row.last_completed_at) : null,
      expiresAt: row.expires_at ? this.toIsoString(row.expires_at) : null,
      status: (row.status as EnrollmentStatus) ?? 'not_started',
    };
  }

  private mapCompletion(row: Record<string, unknown>): CourseCompletion {
    return {
      id: String(row.id),
      enrollmentId: String(row.enrollment_id),
      caregiverId: String(row.caregiver_id),
      courseId: String(row.course_id),
      completedAt: this.toIsoString(row.completed_at),
      score: row.score != null ? Number(row.score) : null,
      notes: row.notes ? String(row.notes) : null,
    };
  }

  private toIsoString(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    return new Date(0).toISOString();
  }
}
