import { z } from 'zod';

// ── Applicant ─────────────────────────────────────────────────────────────

export const applicantStatusValues = [
  'applied',
  'interviewing',
  'interview_complete',
  'under_review',
  'offered',
  'hired',
  'rejected',
] as const;

export const applicantSchema = z.object({
  id: z.string().uuid().optional(),
  agencyId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(200),
  phone: z.string().max(30).optional(),
  position: z.string().max(100).default('Direct Support Associate'),
  coverMessage: z.string().optional(),
  status: z.enum(applicantStatusValues).default('applied'),
  appliedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  adminNotes: z.string().optional(),
});

export type Applicant = z.infer<typeof applicantSchema>;

// ── OnboardingInterview ───────────────────────────────────────────────────

export const interviewStatusValues = ['pending', 'in_progress', 'completed'] as const;

export const interviewMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

export type InterviewMessage = z.infer<typeof interviewMessageSchema>;

export const onboardingInterviewSchema = z.object({
  id: z.string().uuid().optional(),
  applicantId: z.string().uuid(),
  sessionToken: z.string().min(1).max(128),
  messages: z.array(interviewMessageSchema).default([]),
  aiSummary: z.string().optional(),
  aiScore: z.number().int().min(1).max(10).optional(),
  status: z.enum(interviewStatusValues).default('pending'),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime().optional(),
});

export type OnboardingInterview = z.infer<typeof onboardingInterviewSchema>;

// ── OnboardingDocument ────────────────────────────────────────────────────

export const documentTypeValues = [
  'photo_id',
  'ssn_card',
  'tb_test',
  'cpr_cert',
  'drivers_license',
  'background_check_consent',
  'employment_eligibility',
] as const;

export const documentStatusValues = ['requested', 'submitted', 'verified', 'rejected'] as const;

export const onboardingDocumentSchema = z.object({
  id: z.string().uuid().optional(),
  applicantId: z.string().uuid(),
  documentType: z.enum(documentTypeValues),
  status: z.enum(documentStatusValues).default('requested'),
  notes: z.string().optional(),
  requestedAt: z.string().datetime().optional(),
  submittedAt: z.string().datetime().optional(),
  verifiedAt: z.string().datetime().optional(),
  verifiedByUserId: z.string().uuid().optional(),
  createdAt: z.string().datetime().optional(),
});

export type OnboardingDocument = z.infer<typeof onboardingDocumentSchema>;
