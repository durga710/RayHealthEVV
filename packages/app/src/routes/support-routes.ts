/**
 * Public marketing-site support chat — "RayHealthAssist".
 *
 *   POST /support/chat   — unauthenticated; answers visitor questions about
 *                          EVV, scheduling, pricing, and what ships at launch.
 *
 * Mounted in app.ts BEFORE `authContext` so the anonymous marketing widget can
 * reach it without a session, behind its own rate limit. Uses the shared
 * `askAI` (AWS Bedrock / Claude only — no non-BAA fallback) so it rides the
 * same verified credentials as the authenticated copilot.
 *
 * Every turn is appended to `support_conversations` (two rows per exchange).
 * The table is NOT agency-scoped and has no FK to PHI tables; the system
 * prompt forbids the model from soliciting or accepting PHI.
 */
import { Router } from 'express';
import type { Knex } from 'knex';
import { randomUUID } from 'node:crypto';
import { askAI, isAIConfigured } from '../ai.js';
import { safeError } from '../security/safe-log.js';

const router = Router();

const MAX_USER_LEN = 4000;
const MAX_HISTORY = 20;

// System prompt — defines what RayHealthAssist will and won't do. Hard refusals
// around PHI, admin operations, and out-of-domain questions. Kept honest about
// what is live versus roadmap so the bot never over-promises.
const SYSTEM_PROMPT = `You are RayHealthAssist, the customer-support agent on RayHealthEVV's marketing website (rayhealthevv.com). You help home-care agency owners, coordinators, caregivers, and families understand the product and decide whether to book a demo.

What you can help with:
- Explaining what RayHealthEVV does (electronic visit verification, scheduling, billing/claims, payroll reconciliation, workforce training, family visibility)
- Pricing tier guidance (Starter / Growth / Enterprise — all custom-quoted, per-agency, no per-visit surcharges)
- 21st Century Cures Act / Pennsylvania DHS (PROMISe) / EVV compliance basics, including the six federal EVV data elements and task codes 106–256
- How GPS clock-in / clock-out works, geofencing, and telephony / offline fallback
- Pointing visitors at /pricing, /demo, and /contact

What is LIVE today: AI copilot (proposes actions, human approves), conflict-aware scheduling, six-element GPS EVV, billing/claim generation with 837P and denial-risk flags, visit-to-payroll reconciliation with CSV export, and the per-agency tamper-evident audit trail.

What is ROADMAP (be honest — do NOT claim these are live): automated direct transmission to the Sandata aggregator (visits are captured and mapped to the federal schema today, but direct submit needs the agency's trading-partner account), contracted fee-schedule pricing (units are validated today; dollar amounts load once a fee schedule is configured), and direct push to payroll providers like ADP/Paychex/Gusto (CSV export is live).

What you must NEVER do:
- Perform admin operations (creating users, changing passwords, modifying agency config)
- Answer questions about a specific patient, client, caregiver, or visit
- Ask for or accept Protected Health Information (PHI), Medicaid IDs, SSNs, or DOBs
- Make legal or clinical guarantees ("HIPAA-certified", "audit-proof", "FDA-cleared")

If a visitor asks for any of the forbidden things, politely decline and offer to connect them with a human via /contact. Keep replies concise (3-6 sentences) and brand-voice calm — no "disrupt" / "revolutionize", no alarm-bell language. End every reply that's about a feature or pricing with a single soft call-to-action.`;

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

router.post('/chat', async (req, res) => {
  if (!isAIConfigured()) {
    res.status(503).json({
      message:
        'Live support is currently offline. Please use the contact form at /contact and we will reply within one business day.',
    });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const sessionId =
    typeof body.sessionId === 'string' && body.sessionId.length <= 64
      ? body.sessionId
      : randomUUID();
  const messagesRaw = Array.isArray(body.messages) ? body.messages : [];
  if (messagesRaw.length === 0) {
    res.status(400).json({ message: 'messages array is required' });
    return;
  }

  const messages: ChatTurn[] = messagesRaw
    .filter(
      (m): m is ChatTurn =>
        typeof m === 'object' &&
        m !== null &&
        ((m as Record<string, unknown>).role === 'user' ||
          (m as Record<string, unknown>).role === 'assistant') &&
        typeof (m as Record<string, unknown>).content === 'string',
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_USER_LEN) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    res.status(400).json({ message: 'last message must be from the user' });
    return;
  }

  const cf = req.header('cf-connecting-ip');
  const ipAddress = ((cf && cf.trim()) || req.ip || '').toString().slice(0, 64) || null;
  const db = req.app.get('db') as Knex;

  // Log the user turn before calling upstream so we always have it even if the
  // model call fails. Not agency-scoped; the system prompt forbids PHI.
  try {
    await db('support_conversations').insert({
      id: randomUUID(),
      session_id: sessionId,
      role: 'user',
      content: messages[messages.length - 1].content,
      ip_address: ipAddress,
    });
  } catch (err) {
    safeError('support_conversations user-turn insert failed', err);
  }

  let assistantText = '';
  let model = '';
  try {
    const result = await askAI({
      messages,
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 600,
    });
    assistantText = result.text.trim();
    model = result.model;
    if (!assistantText) {
      res.status(502).json({ message: 'Empty response from model.' });
      return;
    }
  } catch (err) {
    safeError('support /chat model call failed', err);
    res.status(502).json({ message: 'Could not reach the model. Try again in a moment.' });
    return;
  }

  // Log the assistant turn.
  try {
    await db('support_conversations').insert({
      id: randomUUID(),
      session_id: sessionId,
      role: 'assistant',
      content: assistantText,
      model,
      ip_address: ipAddress,
    });
  } catch (err) {
    safeError('support_conversations assistant-turn insert failed', err);
  }

  res.json({ sessionId, message: assistantText });
});

export default router;
