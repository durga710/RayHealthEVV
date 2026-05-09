import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Message
} from '@aws-sdk/client-bedrock-runtime';

// Bedrock's TS type for message.role is the string literal "user" | "assistant".
type ConversationRole = 'user' | 'assistant';
import { safeError } from '../security/safe-log.js';

const router = Router();

const MAX_USER_LEN = 4000;
const MAX_HISTORY = 20;
const MODEL_ID =
  process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0';
const REGION = process.env.AWS_REGION || 'us-east-1';

let cachedClient: BedrockRuntimeClient | null = null;
function bedrockClient(): BedrockRuntimeClient {
  if (!cachedClient) cachedClient = new BedrockRuntimeClient({ region: REGION });
  return cachedClient;
}

function bedrockConfigured(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID ||
      process.env.AWS_BEARER_TOKEN_BEDROCK ||
      process.env.AWS_PROFILE
  );
}

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
  if (!bedrockConfigured()) {
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
  // Bedrock fails. Not agency-scoped; visitors who paste PHI here are still
  // recorded but the table has no FK relationship to PHI tables.
  try {
    await db('support_conversations').insert({
      id: randomUUID(),
      session_id: sessionId,
      role: 'user',
      content: messages[messages.length - 1].content,
      model: MODEL_ID,
      ip_address: ipAddress
    });
  } catch (err) {
    safeError('support_conversations user-turn insert failed', err);
  }

  // Call Bedrock Converse. The marketing chat has no tools — pure conversation.
  const conversation: Message[] = messages.map((m) => ({
    role: m.role as ConversationRole,
    content: [{ text: m.content }]
  }));

  let assistantText = '';
  try {
    const response = await bedrockClient().send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: SYSTEM_PROMPT }],
        messages: conversation,
        inferenceConfig: { maxTokens: 600, temperature: 0.4 }
      })
    );
    const out = response.output?.message;
    assistantText =
      (out?.content ?? [])
        .filter((b): b is ContentBlock.TextMember => 'text' in b && typeof b.text === 'string')
        .map((b) => b.text)
        .join('\n')
        .trim() ?? '';
    if (!assistantText) {
      res.status(502).json({ message: 'Empty response from model.' });
      return;
    }
  } catch (err) {
    safeError('support /chat bedrock call failed', err);
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
      model: MODEL_ID,
      ip_address: ipAddress
    });
  } catch (err) {
    safeError('support_conversations assistant-turn insert failed', err);
  }

  res.json({ sessionId, message: assistantText });
});

export default router;
