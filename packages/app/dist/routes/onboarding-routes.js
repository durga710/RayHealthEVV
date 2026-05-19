import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { generateText } from 'ai';
import { OnboardingRepository } from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';
import { aiModel } from '../ai.js';
const router = Router();
const TOTAL_QUESTIONS = 8;
const applyBodySchema = z.object({
    agencyId: z.string().uuid(),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    email: z.string().email().max(200),
    phone: z.string().max(30).optional(),
    position: z.string().max(100).optional(),
    coverMessage: z.string().max(5000).optional(),
});
const messageBodySchema = z.object({
    content: z.string().min(1).max(2000),
});
const INTERVIEW_SYSTEM_PROMPT = `You are a friendly, professional hiring interviewer for a Pennsylvania home care agency. You are conducting a structured text interview with a job applicant for a Direct Support Associate / Caregiver position.

Interview structure (ask exactly these questions in order, one at a time):
Q1: Tell me about yourself and your background in caregiving or direct support work.
Q2: What draws you to working as a Direct Support Associate in home care specifically?
Q3: Describe your availability — days, hours, and whether you can work weekends or holidays.
Q4: Do you have any certifications or training such as CPR, First Aid, CNA, or PA Direct Care Worker training?
Q5: Tell me about a challenging situation you faced while caring for someone. What happened and how did you handle it?
Q6: How do you handle working alone in a client's home without direct supervision?
Q7: What experience do you have assisting with activities of daily living such as bathing, dressing, meal prep, or medication reminders?
Q8: Is there anything else you'd like us to know about your qualifications or why you'd be a great fit?

After Q8 is answered, end with: "Thank you for taking the time to complete this interview. We will review your responses and be in touch soon. Have a great day!"

Rules:
- Ask only ONE question at a time.
- Keep your messages warm and professional but brief.
- Do NOT ask follow-up questions — just acknowledge and move to the next question.
- NEVER ask for Social Security numbers, dates of birth, or other sensitive PII.
- If the applicant says something inappropriate, politely redirect.
- Track where you are in the interview based on how many user messages have been sent.`;
async function callInterviewAI(messages, systemPrompt) {
    const result = await generateText({
        model: aiModel,
        system: systemPrompt,
        messages,
        maxOutputTokens: 600,
    });
    const text = result.text.trim();
    if (!text)
        throw new Error('Empty response from AI');
    return text;
}
async function generateSummaryAndScore(messages) {
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
        const parsed = JSON.parse(text);
        const summary = typeof parsed.summary === 'string' ? parsed.summary : 'Interview completed.';
        const rawScore = typeof parsed.score === 'number' ? parsed.score : 5;
        const score = Math.max(1, Math.min(10, Math.round(rawScore)));
        return { summary, score };
    }
    catch {
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
        const agency = await db('agencies').where({ id: agencyId }).first();
        if (!agency) {
            res.status(404).json({ message: 'Agency not found' });
            return;
        }
        const repo = new OnboardingRepository(db);
        // Create applicant — unique constraint on (agency_id, email) → 409
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
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : '';
            if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
                res.status(409).json({ message: 'You have already applied to this agency.' });
                return;
            }
            throw err;
        }
        // Create interview session
        const sessionToken = randomUUID();
        const interview = await repo.createInterview(applicant.id, sessionToken);
        res.status(201).json({
            applicantId: applicant.id,
            sessionToken: interview.sessionToken,
            message: 'Application received! Your AI interview is ready.',
        });
    }
    catch (error) {
        safeError('POST /onboarding/apply failed', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// GET /onboarding/interview/:token
router.get('/interview/:token', async (req, res) => {
    try {
        const token = req.params.token;
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
        const userMessageCount = interview.messages.filter((m) => m.role === 'user').length;
        const questionsRemaining = Math.max(0, TOTAL_QUESTIONS - userMessageCount);
        const response = {
            status: interview.status,
            messages: interview.messages,
            questionsRemaining,
        };
        if (interview.status === 'completed') {
            response.completed = true;
        }
        res.json(response);
    }
    catch (error) {
        safeError('GET /onboarding/interview/:token failed', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
// POST /onboarding/interview/:token/message
router.post('/interview/:token/message', async (req, res) => {
    try {
        const token = req.params.token;
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
        const updatedMessages = [...interview.messages, { role: 'user', content }];
        const userMessageCount = updatedMessages.filter((m) => m.role === 'user').length;
        // Mark started if first message
        const now = new Date().toISOString();
        const startedAt = interview.startedAt ?? now;
        // Call AI for the next interviewer message
        const aiMessages = updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
        }));
        let aiReply;
        try {
            aiReply = await callInterviewAI(aiMessages, INTERVIEW_SYSTEM_PROMPT);
        }
        catch (err) {
            safeError('Interview Anthropic call failed', err);
            res.status(502).json({ message: 'Could not reach the interview service. Please try again.' });
            return;
        }
        updatedMessages.push({ role: 'assistant', content: aiReply });
        const isCompleted = userMessageCount >= TOTAL_QUESTIONS;
        const questionsRemaining = Math.max(0, TOTAL_QUESTIONS - userMessageCount);
        const nextStatus = isCompleted
            ? 'completed'
            : interview.status === 'pending'
                ? 'in_progress'
                : interview.status;
        const patch = {
            messages: updatedMessages,
            status: nextStatus,
            started_at: startedAt,
        };
        if (isCompleted) {
            patch.completed_at = now;
        }
        await repo.updateInterview(interview.id, patch);
        // Generate AI summary after completion (soft failure)
        if (isCompleted) {
            try {
                const { summary, score } = await generateSummaryAndScore(aiMessages);
                await repo.updateInterview(interview.id, {
                    ai_summary: summary,
                    ai_score: score,
                });
                // Update applicant status to interview_complete
                const knex = db;
                await knex('applicants').where({ id: interview.applicantId }).update({
                    status: 'interview_complete',
                    updated_at: now,
                });
            }
            catch (err) {
                safeError('Interview summarization failed', err);
            }
        }
        res.json({
            message: aiReply,
            completed: isCompleted,
            questionsRemaining,
        });
    }
    catch (error) {
        safeError('POST /onboarding/interview/:token/message failed', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
export default router;
//# sourceMappingURL=onboarding-routes.js.map