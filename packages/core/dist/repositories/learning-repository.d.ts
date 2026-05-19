import type { Knex } from 'knex';
import type { AssignmentComplianceCheck, CaregiverLearningProgress, CourseAnalyticsEnvelope, CourseCaregiverEnvelope, CourseCompletion, CourseEnrollment, LearningAgencyRollup, LearningCourse, LearningInsightsEnvelope, NewCourseCompletion, NewCourseEnrollment, NewLearningCourse } from '../domain/learning.js';
export declare class LearningRepository {
    private readonly db;
    constructor(db: Knex);
    listCourses(agencyId: string): Promise<LearningCourse[]>;
    findCourseById(id: string): Promise<LearningCourse | undefined>;
    findCourseByCode(agencyId: string | null, code: string): Promise<LearningCourse | undefined>;
    createCourse(data: NewLearningCourse): Promise<LearningCourse>;
    /** Idempotent upsert by (agency_id, code). Used by the catalog seed script. */
    upsertCourseByCode(data: NewLearningCourse): Promise<LearningCourse>;
    listEnrollmentsForCaregiver(caregiverId: string): Promise<CourseEnrollment[]>;
    findEnrollment(caregiverId: string, courseId: string): Promise<CourseEnrollment | undefined>;
    markInProgress(enrollmentId: string): Promise<void>;
    enroll(data: NewCourseEnrollment): Promise<CourseEnrollment>;
    recordCompletion(data: NewCourseCompletion): Promise<CourseCompletion>;
    getAgencyRollup(agencyId: string, now?: Date): Promise<LearningAgencyRollup>;
    getCaregiverProgress(caregiverId: string, now?: Date): Promise<CaregiverLearningProgress>;
    getCourseAnalytics(agencyId: string, now?: Date): Promise<CourseAnalyticsEnvelope>;
    getCourseCaregivers(courseId: string, agencyId: string, now?: Date): Promise<CourseCaregiverEnvelope | undefined>;
    getAssignmentBlockers(caregiverId: string, now?: Date): Promise<AssignmentComplianceCheck>;
    getActionableInsights(agencyId: string, now?: Date): Promise<LearningInsightsEnvelope>;
    private fetchInsightRows;
    private toInsightCaregiver;
    private formatRelative;
    private deriveStatus;
    private mapCourse;
    private mapEnrollment;
    private mapCompletion;
    private toIsoString;
}
//# sourceMappingURL=learning-repository.d.ts.map