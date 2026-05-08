import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { safeError } from '../security/safe-log.js';

const router = Router();

const MAX_USER_LEN = 4000;
const MAX_HISTORY = 20;
const MODEL = process.env.SUPPORT_MODEL || 'gpt-4o-mini';

// System prompt — defines what RayHealthAssist will and won't do. Hard
// refusals around PHI, admin operations, and out-of-domain questions.
const SYSTEM_PROMPT = `You are RayHealthAssist, the customer-support agent on RayHealthEVV's marketing website (rayhealthevv.com). You help home-care agency owners, coordinators, caregivers, and families understand the product and decide whether to book a demo.

What you can help with:
- Explaining what RayHealthEVV does (EVV, scheduling, billing readiness, payroll readiness, training, family visibility)
- Pricing tier guidance (Starter / Standard / Enterprise)
- 21st Century Cures Act / Pennsylvania DHS / EVV compliance basics
- How clock-in / clock-out works, the 30-second haptic confirmation, geofencing
- Pointing visitors at /pricing, /demo, /contact, /launch, /status

What you must NEVER do:
- Perform admin operations (creating users, changing passwords, modifying agency config)
- Answer questions about a specific patient, client, caregiver, or visit
- Ask for or accept Protected Health Information (PHI), Medicaid IDs, SSNs, or DOBs
- Make legal or clinical claims ("HIPAA-certified", "audit-proof", "FDA-cleared")
- Promise features that are not yet shipped — Billing readiness, Payroll readiness, Quality assurance, Academy, and Family portal are roadmap items, not live

If a visitor asks for any of the forbidden things, politely decline and offer to connect them with a human via /contact. Keep replies concise (3-6 sentences) and brand-voice calm — no "disrupt" / "revolutionize", no alarm-bell language. End every reply that's about a feature or pricing with a single soft call-to-action.`;

router.post('/chat', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY || process.env.RAY_OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      message:
        'Live support is currently offline. Please use the contact form at /contact and we will reply within one business day.'
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

  // Accept only well-shaped {role, content} entries; cap history.
  const messages = messagesRaw
    .filter(
      (m): m is { role: 'user' | 'assistant'; content: string } =>
        typeof m === 'object' &&
        m !== null &&
        ((m as Record<string, unknown>).role === 'user' ||
          (m as Record<string, unknown>).role === 'assistant') &&
        typeof (m as Record<string, unknown>).content === 'string'
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_USER_LEN) }));

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    res.status(400).json({ message: 'last message must be from the user' });
    return;
  }

  const cf = req.header('cf-connecting-ip');
  const ipAddress = ((cf && cf.trim()) || req.ip || '').toString().slice(0, 64) || null;
  const db = req.app.get('db');

  // Log the user turn before calling upstream so we always have it even if
  // OpenAI fails. Not agency-scoped; visitors who paste PHI here are still
  // recorded but the table has no FK relationship to PHI tables.
  try {
    await db('support_conversations').insert({
      id: randomUUID(),
      session_id: sessionId,
      role: 'user',
      content: messages[messages.length - 1].content,
      model: MODEL,
      ip_address: ipAddress
    });
  } catch (err) {
    safeError('support_conversations user-turn insert failed', err);
  }

  // Call OpenAI.
  let assistantText = '';
  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 600,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages]
      })
    });
    if (!upstream.ok) {
      const errText = await upstream.text();
      safeError(`openai upstream ${upstream.status}`, errText.slice(0, 400));
      res.status(502).json({ message: 'Upstream model error. Please try again in a moment.' });
      return;
    }
    const data = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    assistantText = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!assistantText) {
      res.status(502).json({ message: 'Empty response from model.' });
      return;
    }
  } catch (err) {
    safeError('support /chat upstream call failed', err);
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
      model: MODEL,
      ip_address: ipAddress
    });
  } catch (err) {
    safeError('support_conversations assistant-turn insert failed', err);
  }

  res.json({ sessionId, message: assistantText });
});

export default router;
