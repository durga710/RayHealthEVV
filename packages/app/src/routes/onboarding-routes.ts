import { Router } from 'express';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { generateText } from 'ai';
import {
  AgencyRepository,
  OnboardingRepository,
  documentTypeValues,
  type OnboardingInterview,
} from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';
import { aiModel } from '../ai.js';
import { CURRENT_TERMS_VERSION } from '../terms.js';

const router = Router();
const TOTAL_QUESTIONS = 8;

/**
 * The interview must never strand an applicant: when the AI provider is down
 * or unconfigured, fall back to the same scripted questions the system prompt
 * drives, keyed off how many answers have come in.
 */
const SCRIPTED_QUESTIONS = [
  "Hi! Thanks for applying. Let's get started, tell me a bit about yourself and your background in caregiving or direct support work.",
  'Thank you! What draws you to working as a Direct Support Associate in home care specifically?',
  'Great. Could you describe your availability, days, hours, and whether you can work weekends or holidays?',
  'Do you have any certifications or training such as CPR, First Aid, CNA, or PA Direct Care Worker training?',
  'Tell me about a challenging situation you faced while caring for someone. What happened and how did you handle it?',
  "How do you handle working alone in a client's home without direct supervision?",
  'What experience do you have assisting with activities of daily living such as bathing, dressing, meal prep, or medication reminders?',
  "Almost done! Is there anything else you'd like us to know about your qualifications or why you'd be a great fit?",
];
const CLOSING_MESSAGE =
  'Thank you for taking the time to complete this interview. We will review your responses and be in touch soon. Have a great day!';

/** Documents every new applicant is asked for up front, visible in their portal. */
const STANDARD_DOCUMENT_SET = documentTypeValues;

const applyBodySchema = z.object({
  agencyId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(200),
  phone: z.string().max(30).optional(),
  position: z.string().max(100).optional(),
  coverMessage: z.string().max(5000).optional(),
  // Affirmative Terms of Service acceptance is required to submit an application.
  acceptedTerms: z.literal(true, { message: 'You must accept the Terms of Service to apply' }),
});

const messageBodySchema = z.object({
  content: z.string().min(1).max(2000),
});

const INTERVIEW_SYSTEM_PROMPT = `You are a friendly, professional hiring interviewer for a Pennsylvania home care agency. You are conducting a structured text interview with a job applicant for a Direct Support Associate / Caregiver position.

Interview structure (ask exactly these questions in order, one at a time):
Q1: Tell me about yourself and your background in caregiving or direct support work.
Q2: What draws you to working as a Direct Support Associate in home care specifically?
Q3: Describe your availability, days, hours, and whether you can work weekends or holidays.
Q4: Do you have any certifications or training such as CPR, First Aid, CNA, or PA Direct Care Worker training?
Q5: Tell me about a challenging situation you faced while caring for someone. What happened and how did you handle it?
Q6: How do you handle working alone in a client's home without direct supervision?
Q7: What experience do you have assisting with activities of daily living such as bathing, dressing, meal prep, or medication reminders?
Q8: Is there anything else you'd like us to know about your qualifications or why you'd be a great fit?

After Q8 is answered, end with: "Thank you for taking the time to complete this interview. We will review your responses and be in touch soon. Have a great day!"

Rules:
- Ask only ONE question at a time.
- Keep your messages warm and professional but brief.
- Do NOT ask follow-up questions, just acknowledge and move to the next question.
- NEVER ask for Social Security numbers, dates of birth, or other sensitive PII.
- If the applicant says something inappropriate, politely redirect.
- Track where you are in the interview based on how many user messages have been sent.`;

interface InterviewMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function callInterviewAI(
  messages: InterviewMessage[],
  systemPrompt: string
): Promise<string> {
  const result = await generateText({
    model: aiModel,
    system: systemPrompt,
    messages,
    maxOutputTokens: 600,
  });
  const text = result.text.trim();
  if (!text) throw new Error('Empty response from AI');
  return text;
}

async function generateSummaryAndScore(
  messages: InterviewMessage[]
): Promise<{ summary: string; score: number }> {
  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'Applicant' : 'Interviewer'}: ${m.content}`)
    .join('\n\n');

  const summarizePrompt = `You reviewed a job interview transcript for a Direct Support Associate / Caregiver position at a Pennsylvania home care agency.

Transcript:
${transcript}

Provide:
1. A 3-4 sentence summary of the applicant's qualifications, experience, and fit for the role.
2. A score from 1-10 (10 = excellent fit) based on their answers.

Respond in this exact JSON format (no other text):
{"summary": "...", "score": <integer 1-10>}`;

  try {
    const result = await generateText({
      model: aiModel,
      messages: [{ role: 'user', content: summarizePrompt }],
      maxOutputTokens: 400,
    });
    const text = result.text.trim();
    const parsed = JSON.parse(text) as { summary?: unknown; score?: unknown };
    const summary = typeof parsed.summary === 'string' ? parsed.summary : 'Interview completed.';
    const rawScore = typeof parsed.score === 'number' ? parsed.score : 5;
    const score = Math.max(1, Math.min(10, Math.round(rawScore)));
    return { summary, score };
  } catch {
    return { summary: 'Interview completed.', score: 5 };
  }
}

// POST /onboarding/apply
router.post('/apply', async (req, res) => {
  try {
    const parse = applyBodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ message: 'Invalid request', errors: parse.error.issues });
      return;
    }

    const { agencyId, firstName, lastName, email, phone, position, coverMessage } = parse.data;
    const db = req.app.get('db');

    // Verify agency exists
    const agency = await (db as { (table: string): { where: (q: Record<string, string>) => { first: () => Promise<Record<string, unknown> | undefined> } } })('agencies').where({ id: agencyId }).first();
    if (!agency) {
      res.status(404).json({ message: 'Agency not found' });
      return;
    }

    const repo = new OnboardingRepository(db);

    // Create applicant, unique constraint on (agency_id, email) → 409
    let applicant;
    try {
      applicant = await repo.createApplicant({
        agencyId,
        firstName,
        lastName,
        email,
        phone,
        position: position ?? 'Direct Support Associate',
        coverMessage,
        status: 'applied',
      });
      await repo.recordTermsAcceptance(applicant.id!, CURRENT_TERMS_VERSION);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
        res.status(409).json({ message: 'You have already applied to this agency.' });
        return;
      }
      throw err;
    }

    // Create interview session
    const sessionToken = randomUUID();
    const interview = await repo.createInterview(applicant.id!, sessionToken);

    // Open the standard onboarding checklist immediately so the applicant's
    // portal shows what to upload without waiting on an admin to ask.
    try {
      for (const documentType of STANDARD_DOCUMENT_SET) {
        await repo.requestDocument(applicant.id!, documentType);
      }
    } catch (err) {
      safeError('auto document-request failed (applicant can still interview)', err);
    }

    res.status(201).json({
      applicantId: applicant.id,
      sessionToken: interview.sessionToken,
      message: 'Application received! Your AI interview is ready.',
    });
  } catch (error) {
    safeError('POST /onboarding/apply failed', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

const FIRST_QUESTION_FALLBACK = SCRIPTED_QUESTIONS[0];

// GET /onboarding/interview/:token
router.get('/interview/:token', async (req, res) => {
  try {
    const token = String(req.params.token ?? '');
    if (!token || token.length > 128) {
      res.status(400).json({ message: 'Invalid token' });
      return;
    }

    const db = req.app.get('db');
    const repo = new OnboardingRepository(db);
    const interview = await repo.getInterviewByToken(token);

    if (!interview) {
      res.status(404).json({ message: 'Interview not found' });
      return;
    }

    // Auto-generate the opening question on first access so the applicant
    // isn't staring at a blank chat window.
    if (interview.messages.length === 0 && interview.status === 'pending') {
      let greeting = FIRST_QUESTION_FALLBACK;
      try {
        greeting = await callInterviewAI([], INTERVIEW_SYSTEM_PROMPT);
      } catch {
        // static fallback already set
      }
      const firstMessage = { role: 'assistant' as const, content: greeting };
      await repo.updateInterview(interview.id!, { messages: [firstMessage] });
      interview.messages = [firstMessage];
    }

    const userMessageCount = interview.messages.filter((m) => m.role === 'user').length;
    const questionsRemaining = Math.max(0, TOTAL_QUESTIONS - userMessageCount);

    const response: Record<string, unknown> = {
      status: interview.status,
      messages: interview.messages,
      questionsRemaining,
    };

    if (interview.status === 'completed') {
      response.completed = true;
    }

    res.json(response);
  } catch (error) {
    safeError('GET /onboarding/interview/:token failed', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /onboarding/interview/:token/message
router.post('/interview/:token/message', async (req, res) => {
  try {
    const token = String(req.params.token ?? '');
    if (!token || token.length > 128) {
      res.status(400).json({ message: 'Invalid token' });
      return;
    }

    const parse = messageBodySchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ message: 'Invalid request', errors: parse.error.issues });
      return;
    }

    const { content } = parse.data;
    const db = req.app.get('db');
    const repo = new OnboardingRepository(db);
    const interview = await repo.getInterviewByToken(token);

    if (!interview) {
      res.status(404).json({ message: 'Interview not found' });
      return;
    }

    if (interview.status === 'completed') {
      res.json({ completed: true, message: 'Your interview is already complete.' });
      return;
    }

    // Add user message
    const updatedMessages = [...interview.messages, { role: 'user' as const, content }];
    const userMessageCount = updatedMessages.filter((m) => m.role === 'user').length;

    // Mark started if first message
    const now = new Date().toISOString();
    const startedAt = interview.startedAt ?? now;

    // Call AI for the next interviewer message
    const aiMessages: InterviewMessage[] = updatedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let aiReply: string;
    try {
      aiReply = await callInterviewAI(aiMessages, INTERVIEW_SYSTEM_PROMPT);
    } catch (err) {
      // Never strand the applicant on an AI outage: continue with the scripted
      // question for wherever they are in the interview (Q1 was the greeting,
      // so after N answers the next question is SCRIPTED_QUESTIONS[N]).
      safeError('Interview AI call failed; using scripted question', err);
      aiReply =
        userMessageCount >= TOTAL_QUESTIONS
          ? CLOSING_MESSAGE
          : SCRIPTED_QUESTIONS[userMessageCount] ?? CLOSING_MESSAGE;
    }

    updatedMessages.push({ role: 'assistant', content: aiReply });

    const isCompleted = userMessageCount >= TOTAL_QUESTIONS;
    const questionsRemaining = Math.max(0, TOTAL_QUESTIONS - userMessageCount);

    const nextStatus: OnboardingInterview['status'] = isCompleted
      ? 'completed'
      : interview.status === 'pending'
        ? 'in_progress'
        : interview.status;

    const patch: {
      messages: typeof updatedMessages;
      status: OnboardingInterview['status'];
      started_at: string;
      completed_at?: string;
    } = {
      messages: updatedMessages,
      status: nextStatus,
      started_at: startedAt,
    };

    if (isCompleted) {
      patch.completed_at = now;
    }

    await repo.updateInterview(interview.id!, patch);

    // Generate AI summary after completion (soft failure)
    if (isCompleted) {
      try {
        const { summary, score } = await generateSummaryAndScore(aiMessages);
        await repo.updateInterview(interview.id!, {
          ai_summary: summary,
          ai_score: score,
        });
        // Update applicant status to interview_complete
        const knex = db as { (t: string): { where: (q: Record<string, string>) => { update: (u: Record<string, unknown>) => Promise<number> } } };
        await knex('applicants').where({ id: interview.applicantId }).update({
          status: 'interview_complete',
          updated_at: now,
        });
      } catch (err) {
        safeError('Interview summarization failed', err);
      }
    }

    res.json({
      message: aiReply,
      completed: isCompleted,
      questionsRemaining,
    });
  } catch (error) {
    safeError('POST /onboarding/interview/:token/message failed', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ── Public agency hiring page ───────────────────────────────────────────────

// GET /onboarding/agency-page/:slug , resolve a public slug to the info the
// public homepage + apply form need. Unauthenticated by design; exposes only
// public-page fields (see AgencyRepository.getPublicPageBySlug).
router.get('/agency-page/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug ?? '').toLowerCase();
    if (!/^[a-z0-9-]{3,60}$/.test(slug)) {
      res.status(404).json({ message: 'Page not found' });
      return;
    }
    const page = await new AgencyRepository(req.app.get('db')).getPublicPageBySlug(slug);
    if (!page) {
      res.status(404).json({ message: 'Page not found' });
      return;
    }
    res.json(page);
  } catch (error) {
    safeError('GET /onboarding/agency-page/:slug failed', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ── Applicant portal (interview token = the applicant's credential) ─────────

// GET /onboarding/portal/:token , the applicant's own view: interview
// progress + document checklist. Serves metadata only, never file bytes.
router.get('/portal/:token', async (req, res) => {
  try {
    const token = String(req.params.token ?? '');
    if (!token || token.length > 128) {
      res.status(400).json({ message: 'Invalid token' });
      return;
    }
    const portal = await new OnboardingRepository(req.app.get('db')).getPortalByToken(token);
    if (!portal) {
      res.status(404).json({ message: 'Portal not found' });
      return;
    }
    res.json({
      applicant: {
        firstName: portal.applicant.firstName,
        lastName: portal.applicant.lastName,
        position: portal.applicant.position,
        status: portal.applicant.status,
      },
      agencyName: portal.agencyName,
      interview: {
        status: portal.interview.status,
        questionsRemaining: Math.max(
          0,
          TOTAL_QUESTIONS - portal.interview.messages.filter((m) => m.role === 'user').length,
        ),
      },
      documents: portal.documents.map((d) => ({
        id: d.id,
        documentType: d.documentType,
        status: d.status,
        fileName: d.fileName ?? null,
        submittedAt: d.submittedAt ?? null,
      })),
    });
  } catch (error) {
    safeError('GET /onboarding/portal/:token failed', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** Upload constraints: the formats agencies actually receive, capped at 5 MB. */
const UPLOAD_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const UPLOAD_LIMIT = '5mb';
const uploadBody = express.raw({ type: () => true, limit: UPLOAD_LIMIT });

// POST /onboarding/portal/:token/documents/:docId , the actual document
// upload the "request document" flow was always missing. Raw body, typed via
// content-type header, original filename via ?filename=.
router.post('/portal/:token/documents/:docId', uploadBody, async (req, res) => {
  try {
    const token = String(req.params.token ?? '');
    if (!token || token.length > 128) {
      res.status(400).json({ message: 'Invalid token' });
      return;
    }
    // Headers are typed string | string[]; take exactly one string before it
    // can flow anywhere (CodeQL js/type-confusion-through-parameter-tampering).
    const rawContentType = req.headers['content-type'];
    const contentType = String(Array.isArray(rawContentType) ? rawContentType[0] : rawContentType ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (!UPLOAD_CONTENT_TYPES.has(contentType)) {
      res.status(415).json({
        message: 'Upload must be a JPEG, PNG, WebP image or a PDF',
      });
      return;
    }
    const data = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (data.length === 0) {
      res.status(400).json({ message: 'Upload body is empty' });
      return;
    }
    const rawName = typeof req.query.filename === 'string' ? req.query.filename : 'document';
    // Keep only a safe basename , this is echoed back in content-disposition.
    const fileName = rawName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 200) || 'document';

    const repo = new OnboardingRepository(req.app.get('db'));
    const interview = await repo.getInterviewByToken(token);
    if (!interview) {
      res.status(404).json({ message: 'Portal not found' });
      return;
    }
    const doc = await repo.submitDocumentFile(String(req.params.docId), interview.applicantId, {
      fileName,
      contentType,
      data,
    });
    if (!doc) {
      res.status(409).json({
        message: 'This document is not awaiting an upload (already submitted or verified).',
      });
      return;
    }
    res.status(201).json(doc);
  } catch (error) {
    safeError('POST /onboarding/portal/:token/documents/:docId failed', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
