import { z } from 'zod';
export declare const applicantStatusValues: readonly ["applied", "interviewing", "interview_complete", "under_review", "offered", "hired", "rejected"];
export declare const applicantSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    agencyId: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    email: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    position: z.ZodDefault<z.ZodString>;
    coverMessage: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<{
        rejected: "rejected";
        applied: "applied";
        interviewing: "interviewing";
        interview_complete: "interview_complete";
        under_review: "under_review";
        offered: "offered";
        hired: "hired";
    }>>;
    appliedAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
    adminNotes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Applicant = z.infer<typeof applicantSchema>;
export declare const interviewStatusValues: readonly ["pending", "in_progress", "completed"];
export declare const interviewMessageSchema: z.ZodObject<{
    role: z.ZodEnum<{
        user: "user";
        assistant: "assistant";
    }>;
    content: z.ZodString;
}, z.core.$strip>;
export type InterviewMessage = z.infer<typeof interviewMessageSchema>;
export declare const onboardingInterviewSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    applicantId: z.ZodString;
    sessionToken: z.ZodString;
    messages: z.ZodDefault<z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<{
            user: "user";
            assistant: "assistant";
        }>;
        content: z.ZodString;
    }, z.core.$strip>>>;
    aiSummary: z.ZodOptional<z.ZodString>;
    aiScore: z.ZodOptional<z.ZodNumber>;
    status: z.ZodDefault<z.ZodEnum<{
        pending: "pending";
        completed: "completed";
        in_progress: "in_progress";
    }>>;
    startedAt: z.ZodOptional<z.ZodString>;
    completedAt: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type OnboardingInterview = z.infer<typeof onboardingInterviewSchema>;
export declare const documentTypeValues: readonly ["photo_id", "ssn_card", "tb_test", "cpr_cert", "drivers_license", "background_check_consent", "employment_eligibility"];
export declare const documentStatusValues: readonly ["requested", "submitted", "verified", "rejected"];
export declare const onboardingDocumentSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    applicantId: z.ZodString;
    documentType: z.ZodEnum<{
        photo_id: "photo_id";
        ssn_card: "ssn_card";
        tb_test: "tb_test";
        cpr_cert: "cpr_cert";
        drivers_license: "drivers_license";
        background_check_consent: "background_check_consent";
        employment_eligibility: "employment_eligibility";
    }>;
    status: z.ZodDefault<z.ZodEnum<{
        verified: "verified";
        submitted: "submitted";
        rejected: "rejected";
        requested: "requested";
    }>>;
    notes: z.ZodOptional<z.ZodString>;
    requestedAt: z.ZodOptional<z.ZodString>;
    submittedAt: z.ZodOptional<z.ZodString>;
    verifiedAt: z.ZodOptional<z.ZodString>;
    verifiedByUserId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type OnboardingDocument = z.infer<typeof onboardingDocumentSchema>;
//# sourceMappingURL=onboarding.d.ts.map