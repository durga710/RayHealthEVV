import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Message,
  type Tool
} from '@aws-sdk/client-bedrock-runtime';

// Bedrock's TS type for message.role is the string literal "user" | "assistant".
type ConversationRole = 'user' | 'assistant';
import { safeError } from '../security/safe-log.js';

const router = Router();

const MAX_USER_LEN = 4000;
const MAX_HISTORY = 20;
const MAX_TOOL_LOOPS = 4;

// Bedrock under the AWS BAA covers PHI workloads. Default to Claude 3.5
// Haiku (cheap, fast). The `us.` prefix is a cross-region inference profile
// — falls back across us-east-1 / us-east-2 / us-west-2 automatically.
const MODEL_ID =
  process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-3-5-haiku-20241022-v1:0';
const REGION = process.env.AWS_REGION || 'us-east-1';

let cachedClient: BedrockRuntimeClient | null = null;
function bedrockClient(): BedrockRuntimeClient {
  if (!cachedClient) cachedClient = new BedrockRuntimeClient({ region: REGION });
  return cachedClient;
}

function bedrockConfigured(): boolean {
  // SDK default credential chain covers env vars, IAM, etc. We treat the
  // assistant as "online" if EITHER explicit credentials are present OR
  // AWS_BEARER_TOKEN_BEDROCK is set (Bedrock-only short-lived token).
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID ||
      process.env.AWS_BEARER_TOKEN_BEDROCK ||
      process.env.AWS_PROFILE
  );
}

const SYSTEM_PROMPT = `You are RayHealthOps, the in-app assistant for RayHealthEVV. The user is a coordinator or admin signed into their agency's account. You can answer operational questions about THIS agency by calling the provided tools. NEVER:
- mention specific patient/client names or full PHI fields unless the user explicitly asked for a single record
- perform admin operations (creating users, changing passwords, modifying agency settings) — instead point to the relevant /admin/* page
- invent counts or numbers — always call a tool to get them

When unsure, call a tool. Keep replies concise (3-5 sentences). End feature-related answers with one soft suggestion.`;

// Bedrock Converse uses a slightly different tool schema than OpenAI's
// function-calling: each tool is a `{toolSpec: {name, description, inputSchema:
// {json}}}` object, and `inputSchema.json` IS the JSON Schema directly.
const TOOLS: Tool[] = [
  {
    toolSpec: {
      name: 'count_visits',
      description: "Count this agency's EVV visits in a date range. Returns just a count, no PHI.",
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'ISO date YYYY-MM-DD or ISO 8601' },
            to: { type: 'string', description: 'ISO date YYYY-MM-DD or ISO 8601' }
          }
        }
      }
    }
  },
  {
    toolSpec: {
      name: 'list_open_exceptions',
      description:
        'Counts of evv_exceptions for this agency grouped by type. No names, no patient data.',
      inputSchema: { json: { type: 'object', properties: {} } }
    }
  },
  {
    toolSpec: {
      name: 'count_expiring_credentials',
      description:
        'Counts caregiver_credentials that expire within `withinDays` days, grouped by credential_type.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            withinDays: { type: 'integer', description: 'Default 30. Range 1-365.' }
          }
        }
      }
    }
  },
  {
    toolSpec: {
      name: 'agency_overview',
      description:
        'High-level snapshot: counts of clients, caregivers, users, and visits in the last 30 days.',
      inputSchema: { json: { type: 'object', properties: {} } }
    }
  }
];

interface ToolContext {
  db: unknown;
  agencyId: string;
}

async function runTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<Record<string, unknown>> {
  const knex = ctx.db as {
    raw: (q: string, b?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  };

  switch (name) {
    case 'count_visits': {
      const fromIso =
        typeof args.from === 'string' && args.from ? new Date(args.from).toISOString() : null;
      const toIso =
        typeof args.to === 'string' && args.to
          ? new Date(`${args.to}T23:59:59.999Z`).toISOString()
          : null;
      let q = `select count(*)::int as count
               from evv_visits v
               join users u on u.caregiver_id = v.caregiver_id
               where u.agency_id = $1`;
      const bind: unknown[] = [ctx.agencyId];
      if (fromIso) {
        bind.push(fromIso);
        q += ` and v.clock_in_time >= $${bind.length}`;
      }
      if (toIso) {
        bind.push(toIso);
        q += ` and v.clock_in_time <= $${bind.length}`;
      }
      const r = await knex.raw(q, bind);
      return { count: Number(r.rows[0]?.count ?? 0), from: fromIso, to: toIso };
    }
    case 'list_open_exceptions': {
      const r = await knex.raw(
        `select exception_type, count(*)::int as count
         from evv_exceptions e
         join evv_visits v on v.id = e.visit_id
         join users u on u.caregiver_id = v.caregiver_id
         where u.agency_id = $1
         group by exception_type
         order by count desc`,
        [ctx.agencyId]
      );
      const byType: Record<string, number> = {};
      let total = 0;
      for (const row of r.rows) {
        const type = String(row.exception_type ?? 'unknown');
        const n = Number(row.count ?? 0);
        byType[type] = n;
        total += n;
      }
      return { total, byType };
    }
    case 'count_expiring_credentials': {
      const within = Math.max(1, Math.min(365, Number(args.withinDays ?? 30)));
      const r = await knex.raw(
        `select credential_type, count(*)::int as count
         from caregiver_credentials cc
         join caregivers c on c.id = cc.caregiver_id
         where c.agency_id = $1
           and cc.expires_at <= (now() + ($2::int || ' days')::interval)
           and cc.status <> 'expired'
         group by credential_type
         order by count desc`,
        [ctx.agencyId, within]
      );
      const byType: Record<string, number> = {};
      let total = 0;
      for (const row of r.rows) {
        const type = String(row.credential_type ?? 'unknown');
        const n = Number(row.count ?? 0);
        byType[type] = n;
        total += n;
      }
      return { total, byType, withinDays: within };
    }
    case 'agency_overview': {
      const r = await knex.raw(
        `select
           (select count(*)::int from clients where agency_id = $1) as clients,
           (select count(*)::int from caregivers where agency_id = $1) as caregivers,
           (select count(*)::int from users where agency_id = $1) as users,
           (select count(*)::int
            from evv_visits v
            join users u on u.caregiver_id = v.caregiver_id
            where u.agency_id = $1
              and v.clock_in_time >= now() - interval '30 days') as visits_30d`,
        [ctx.agencyId]
      );
      return r.rows[0] ?? { clients: 0, caregivers: 0, users: 0, visits_30d: 0 };
    }
    default:
      return { error: `unknown tool: ${name}` };
  }
}

router.post('/chat', async (req, res) => {
  if (!bedrockConfigured()) {
    res.status(503).json({
      message:
        'Admin assistant is offline (AWS Bedrock not configured — set AWS_REGION + credentials).'
    });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const messagesRaw = Array.isArray(body.messages) ? body.messages : [];
  const sessionId =
    typeof body.sessionId === 'string' && body.sessionId.length <= 64
      ? body.sessionId
      : randomUUID();

  const incoming = messagesRaw
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

  if (incoming.length === 0 || incoming[incoming.length - 1].role !== 'user') {
    res.status(400).json({ message: 'last message must be from the user' });
    return;
  }

  const db = req.app.get('db');
  const ctx: ToolContext = { db, agencyId: req.auth.agencyId };

  // Bedrock Converse requires a separate `system` array and `messages` whose
  // content is `{text}` blocks (or tool-use / tool-result blocks).
  const conversation: Message[] = incoming.map((m) => ({
    role: m.role as ConversationRole,
    content: [{ text: m.content }]
  }));

  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    let response;
    try {
      response = await bedrockClient().send(
        new ConverseCommand({
          modelId: MODEL_ID,
          system: [{ text: SYSTEM_PROMPT }],
          messages: conversation,
          inferenceConfig: { maxTokens: 800, temperature: 0.2 },
          toolConfig: { tools: TOOLS, toolChoice: { auto: {} } }
        })
      );
    } catch (err) {
      safeError('admin-assistant bedrock send failed', err);
      res.status(502).json({ message: 'Could not reach the model.' });
      return;
    }

    const out = response.output?.message;
    if (!out || !out.content) {
      res.status(502).json({ message: 'Empty model response.' });
      return;
    }

    // Append assistant turn (which may contain text blocks, toolUse blocks,
    // or both) to the conversation so the next loop iteration sees it.
    conversation.push(out);

    const stopReason = response.stopReason;

    // If the model wants to call tools, run them and loop.
    if (stopReason === 'tool_use') {
      const toolUseBlocks = out.content.filter(
        (b): b is ContentBlock.ToolUseMember => 'toolUse' in b && b.toolUse !== undefined
      );
      const toolResults: ContentBlock[] = [];
      for (const block of toolUseBlocks) {
        const tu = block.toolUse!;
        const argsObj = (tu.input ?? {}) as Record<string, unknown>;
        let toolResult: Record<string, unknown>;
        try {
          toolResult = await runTool(tu.name ?? '', argsObj, ctx);
        } catch (err) {
          safeError(`admin-assistant tool ${tu.name} failed`, err);
          toolResult = { error: 'tool execution failed' };
        }
        toolResults.push({
          toolResult: {
            toolUseId: tu.toolUseId!,
            // Bedrock's `json` block is typed as DocumentType (a recursive
            // primitive/array/object union). Plain `Record<string, unknown>`
            // doesn't structurally match; cast through unknown so the SDK
            // serializes it as JSON without a TS shape complaint.
            content: [{ json: toolResult as unknown as Record<string, never> }]
          }
        });
      }
      conversation.push({ role: 'user', content: toolResults });
      continue;
    }

    // Otherwise extract the final text from text blocks.
    const text = out.content
      .filter((b): b is ContentBlock.TextMember => 'text' in b && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text) {
      res.status(502).json({ message: 'Empty model response.' });
      return;
    }

    try {
      const ip = req.header('cf-connecting-ip') ?? req.ip ?? null;
      await (db as (table: string) => { insert: (rows: unknown[]) => Promise<unknown> })(
        'support_conversations'
      ).insert([
        {
          id: randomUUID(),
          session_id: sessionId,
          role: 'user',
          content: incoming[incoming.length - 1].content,
          model: MODEL_ID,
          ip_address: ip
        },
        {
          id: randomUUID(),
          session_id: sessionId,
          role: 'assistant',
          content: text,
          model: MODEL_ID,
          ip_address: ip
        }
      ]);
    } catch (err) {
      safeError('admin-assistant log insert failed', err);
    }

    res.json({ sessionId, message: text });
    return;
  }

  res
    .status(504)
    .json({ message: 'Assistant ran out of steps. Try a simpler question or split it.' });
});

export default router;
