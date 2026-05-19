/**
 * Learning domain — caregiver training catalog, enrollments, completions.
 *
 * Designed around PA personal-care training requirements (PA Code §52.18 et seq.):
 *   - One-time orientation before first visit
 *   - Annual recurring training (12 hours/year minimum)
 *   - Recertifications with explicit expiry (CPR, first-aid)
 *
 * Compliance posture:
 *   - course_completions is an append-only event log — never updated
 *   - course_enrollments tracks current state (due dates, expiry)
 *   - The pair lets us reconstruct who knew what when, for audit purposes
 */
export type CourseCadence = 'one_time' | 'annual' | 'biennial' | 'certification';
export type EnrollmentStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue' | 'expired';
export interface LearningCourse {
    id: string;
    agencyId: string | null;
    code: string;
    title: string;
    description: string;
    cadence: CourseCadence;
    /** How many days after completion the certification expires. null = never. */
    expiresAfterDays: number | null;
    /** Required for compliance (true) vs elective (false). */
    required: boolean;
    /** Estimated minutes the caregiver needs to complete it. */
    durationMinutes: number;
    /** Link to an external training platform (e.g. PHCA, FEMA EMI). null = no link. */
    externalUrl: string | null;
    createdAt: string;
}
export interface NewLearningCourse {
    agencyId: string | null;
    code: string;
    title: string;
    description: string;
    cadence: CourseCadence;
    expiresAfterDays: number | null;
    required: boolean;
    durationMinutes: number;
    externalUrl?: string | null;
}
export interface CourseEnrollment {
    id: string;
    agencyId: string;
    caregiverId: string;
    courseId: string;
    assignedAt: string;
    dueAt: string | null;
    lastCompletedAt: string | null;
    expiresAt: string | null;
    status: EnrollmentStatus;
}
export interface NewCourseEnrollment {
    agencyId: string;
    caregiverId: string;
    courseId: string;
    dueAt: string | null;
}
export interface CourseCompletion {
    id: string;
    enrollmentId: string;
    caregiverId: string;
    courseId: string;
    completedAt: string;
    score: number | null;
    notes: string | null;
}
export interface NewCourseCompletion {
    enrollmentId: string;
    caregiverId: string;
    courseId: string;
    completedAt: string;
    score: number | null;
    notes: string | null;
}
export interface LearningAgencyRollup {
    totalCaregivers: number;
    totalEnrollments: number;
    notStarted: number;
    inProgress: number;
    completed: number;
    overdue: number;
    expired: number;
    complianceRate: number;
}
export interface CaregiverLearningProgress {
    caregiverId: string;
    enrollments: Array<{
        enrollment: CourseEnrollment;
        course: LearningCourse;
    }>;
    isCompliant: boolean;
}
export type InsightSeverity = 'critical' | 'warning' | 'info';
export interface InsightCaregiver {
    caregiverId: string;
    firstName: string;
    lastName: string;
    context: string;
}
export interface LearningInsight {
    kind: 'due_in_7_days' | 'expired_recently' | 'orientation_incomplete' | 'stalled_enrollment' | 'certification_expiring_soon';
    severity: InsightSeverity;
    title: string;
    summary: string;
    actionLabel: string;
    caregivers: InsightCaregiver[];
    totalCount: number;
}
export interface LearningInsightsEnvelope {
    generatedAt: string;
    insights: LearningInsight[];
}
export interface AssignmentBlocker {
    enrollmentId: string;
    courseCode: string;
    courseTitle: string;
    status: EnrollmentStatus;
    reason: string;
}
export interface AssignmentComplianceCheck {
    compliant: boolean;
    blockers: AssignmentBlocker[];
}
export interface CourseAnalyticsRow {
    courseId: string;
    courseCode: string;
    courseTitle: string;
    required: boolean;
    cadence: CourseCadence;
    totalEnrollments: number;
    completedCount: number;
    overdueCount: number;
    expiredCount: number;
    pendingCount: number;
    completionRate: number;
    averageDaysToComplete: number | null;
}
export interface CourseAnalyticsEnvelope {
    generatedAt: string;
    rows: CourseAnalyticsRow[];
}
export interface CourseCaregiverRow {
    enrollment: CourseEnrollment;
    caregiver: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    effectiveStatus: EnrollmentStatus;
}
export interface CourseCaregiverEnvelope {
    course: LearningCourse;
    caregivers: CourseCaregiverRow[];
}
//# sourceMappingURL=learning.d.ts.map