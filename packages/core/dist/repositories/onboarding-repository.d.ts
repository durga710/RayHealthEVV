import type { Knex } from 'knex';
import type { Applicant, OnboardingInterview, OnboardingDocument, InterviewMessage } from '../domain/onboarding.js';
export declare class OnboardingRepository {
    private readonly db;
    constructor(db: Knex);
    createApplicant(data: Omit<Applicant, 'id' | 'appliedAt' | 'updatedAt'>): Promise<Applicant>;
    findApplicantById(id: string, agencyId: string): Promise<Applicant | null>;
    listApplicants(agencyId: string, status?: string): Promise<Applicant[]>;
    updateApplicantStatus(id: string, agencyId: string, status: Applicant['status'], adminNotes?: string): Promise<Applicant | null>;
    createInterview(applicantId: string, sessionToken: string): Promise<OnboardingInterview>;
    getInterviewByToken(token: string): Promise<OnboardingInterview | null>;
    updateInterview(id: string, patch: {
        messages?: InterviewMessage[];
        ai_summary?: string;
        ai_score?: number;
        status?: OnboardingInterview['status'];
        started_at?: string;
        completed_at?: string;
    }): Promise<OnboardingInterview | null>;
    getInterviewByApplicant(applicantId: string): Promise<OnboardingInterview | null>;
    requestDocument(applicantId: string, documentType: OnboardingDocument['documentType']): Promise<OnboardingDocument>;
    updateDocumentStatus(docId: string, agencyId: string, status: OnboardingDocument['status'], verifiedByUserId?: string): Promise<OnboardingDocument | null>;
    listDocuments(applicantId: string): Promise<OnboardingDocument[]>;
    private mapApplicant;
    private mapInterview;
    private mapDocument;
}
//# sourceMappingURL=onboarding-repository.d.ts.map