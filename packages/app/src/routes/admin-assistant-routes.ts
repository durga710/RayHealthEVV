import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { safeError } from '../security/safe-log.js';
import { aiModel } from '../ai.js';
import { requireCapability } from '../middleware/require-capability.js';

const router = Router();
// Admin assistant is for admin/coordinator only — caregivers have no agency.read capability.
router.use(requireCapability('agency.read'));

const MAX_USER_LEN = 4000;
const MAX_HISTORY = 20;

const SYSTEM_PROMPT = `You are RayHealthOps, the in-app assistant for RayHealthEVV. The user is a coordinator or admin signed into their agency's account. You can answer operational questions about THIS agency by calling the provided tools. NEVER:
- mention specific patient/client names or full PHI fields unless the user explicitly asked for a single record
- perform admin operations (creating users, changing passwords, modifying agency settings) — instead point to the relevant /admin/* page
- invent counts or numbers — always call a tool to get them

When unsure, call a tool. Keep replies concise (3-5 sentences). End feature-related answers with one soft suggestion.`;

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
      if (fromIso) { bind.push(fromIso); q += ` and v.clock_in_time >= $${bind.length}`; }
      if (toIso)   { bind.push(toIso);   q += ` and v.clock_in_time <= $${bind.length}`; }
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

  try {
    const result = await generateText({
      model: aiModel,
      system: SYSTEM_PROMPT,
      messages: incoming,
      maxOutputTokens: 800,
      stopWhen: stepCountIs(4),
      tools: {
        count_visits: tool({
          description: "Count this agency's EVV visits in a date range. Returns just a count, no PHI.",
          inputSchema: z.object({
            from: z.string().optional().describe('ISO date YYYY-MM-DD or ISO 8601'),
            to:   z.string().optional().describe('ISO date YYYY-MM-DD or ISO 8601'),
          }),
          execute: ({ from, to }) => runTool('count_visits', { from, to }, ctx),
        }),
        list_open_exceptions: tool({
          description: 'Counts of evv_exceptions grouped by type. No names, no patient data.',
          inputSchema: z.object({}),
          execute: () => runTool('list_open_exceptions', {}, ctx),
        }),
        count_expiring_credentials: tool({
          description: 'Counts caregiver credentials expiring within withinDays days, grouped by type.',
          inputSchema: z.object({
            withinDays: z.number().int().optional().describe('Default 30. Range 1-365.'),
          }),
          execute: ({ withinDays }) => runTool('count_expiring_credentials', { withinDays }, ctx),
        }),
        agency_overview: tool({
          description: 'High-level snapshot: counts of clients, caregivers, users, visits last 30 days.',
          inputSchema: z.object({}),
          execute: () => runTool('agency_overview', {}, ctx),
        }),
      },
    });

    const text = result.text.trim();
    if (!text) {
      res.status(502).json({ message: 'Empty model response.' });
      return;
    }

    try {
      const ip = req.header('cf-connecting-ip') ?? req.ip ?? null;
      await (db as (table: string) => { insert: (rows: unknown[]) => Promise<unknown> })(
        'support_conversations'
      ).insert([
        { id: randomUUID(), session_id: sessionId, role: 'user',      content: incoming[incoming.length - 1].content, model: process.env.BEDROCK_MODEL_ID ?? 'bedrock', ip_address: ip },
        { id: randomUUID(), session_id: sessionId, role: 'assistant', content: text,                                  model: process.env.BEDROCK_MODEL_ID ?? 'bedrock', ip_address: ip },
      ]);
    } catch (err) {
      safeError('admin-assistant log insert failed', err);
    }

    res.json({ sessionId, message: text });
  } catch (err) {
    safeError('admin-assistant generateText failed', err);
    res.status(502).json({ message: 'Could not reach the assistant.' });
  }
});

export default router;
