import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { safeError } from '../security/safe-log.js';
const router = Router();
const MAX_USER_LEN = 4000;
const MAX_HISTORY = 20;
const MAX_TOOL_LOOPS = 4;
const MODEL = process.env.ADMIN_ASSISTANT_MODEL || process.env.SUPPORT_MODEL || 'gpt-4o-mini';
const SYSTEM_PROMPT = `You are RayHealthOps, the in-app assistant for RayHealthEVV. The user is a coordinator or admin signed into their agency's account. You can answer operational questions about THIS agency by calling the provided tools. NEVER:
- mention specific patient/client names or full PHI fields unless the user explicitly asked for a single record
- perform admin operations (creating users, changing passwords, modifying agency settings) — instead point to the relevant /admin/* page
- invent counts or numbers — always call a tool to get them

When unsure, call a tool. Keep replies concise (3-5 sentences). End feature-related answers with one soft suggestion.`;
const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'count_visits',
            description: "Count this agency's EVV visits in a date range. Returns just a count, no PHI.",
            parameters: {
                type: 'object',
                properties: {
                    from: { type: 'string', description: 'ISO date YYYY-MM-DD or ISO 8601' },
                    to: { type: 'string', description: 'ISO date YYYY-MM-DD or ISO 8601' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'list_open_exceptions',
            description: 'Counts of evv_exceptions for this agency grouped by type. No names, no patient data.',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'count_expiring_credentials',
            description: 'Counts caregiver_credentials that expire within `withinDays` days, grouped by credential_type.',
            parameters: {
                type: 'object',
                properties: {
                    withinDays: { type: 'integer', description: 'Default 30. Range 1-365.' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'agency_overview',
            description: "High-level snapshot: counts of clients, caregivers, users, and visits in the last 30 days.",
            parameters: { type: 'object', properties: {} }
        }
    }
];
async function runTool(name, args, ctx) {
    const knex = ctx.db;
    switch (name) {
        case 'count_visits': {
            const fromIso = typeof args.from === 'string' && args.from ? new Date(args.from).toISOString() : null;
            const toIso = typeof args.to === 'string' && args.to
                ? new Date(`${args.to}T23:59:59.999Z`).toISOString()
                : null;
            let q = `select count(*)::int as count
               from evv_visits v
               join users u on u.caregiver_id = v.caregiver_id
               where u.agency_id = $1`;
            const bind = [ctx.agencyId];
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
            const r = await knex.raw(`select exception_type, count(*)::int as count
         from evv_exceptions e
         join evv_visits v on v.id = e.visit_id
         join users u on u.caregiver_id = v.caregiver_id
         where u.agency_id = $1
         group by exception_type
         order by count desc`, [ctx.agencyId]);
            const byType = {};
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
            const r = await knex.raw(`select credential_type, count(*)::int as count
         from caregiver_credentials cc
         join caregivers c on c.id = cc.caregiver_id
         where c.agency_id = $1
           and cc.expires_at <= (now() + ($2::int || ' days')::interval)
           and cc.status <> 'expired'
         group by credential_type
         order by count desc`, [ctx.agencyId, within]);
            const byType = {};
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
            const r = await knex.raw(`select
           (select count(*)::int from clients where agency_id = $1) as clients,
           (select count(*)::int from caregivers where agency_id = $1) as caregivers,
           (select count(*)::int from users where agency_id = $1) as users,
           (select count(*)::int
            from evv_visits v
            join users u on u.caregiver_id = v.caregiver_id
            where u.agency_id = $1
              and v.clock_in_time >= now() - interval '30 days') as visits_30d`, [ctx.agencyId]);
            return r.rows[0] ?? { clients: 0, caregivers: 0, users: 0, visits_30d: 0 };
        }
        default:
            return { error: `unknown tool: ${name}` };
    }
}
router.post('/chat', async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY || process.env.RAY_OPENAI_API_KEY;
    if (!apiKey) {
        res.status(503).json({
            message: 'Admin assistant is offline (OPENAI_API_KEY not configured).'
        });
        return;
    }
    const body = (req.body ?? {});
    const messagesRaw = Array.isArray(body.messages) ? body.messages : [];
    const sessionId = typeof body.sessionId === 'string' && body.sessionId.length <= 64
        ? body.sessionId
        : randomUUID();
    const messages = messagesRaw
        .filter((m) => typeof m === 'object' &&
        m !== null &&
        (m.role === 'user' ||
            m.role === 'assistant') &&
        typeof m.content === 'string')
        .slice(-MAX_HISTORY)
        .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_USER_LEN) }));
    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
        res.status(400).json({ message: 'last message must be from the user' });
        return;
    }
    const db = req.app.get('db');
    const ctx = { db, agencyId: req.auth.agencyId };
    const convo = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
    ];
    for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
        let upstream;
        try {
            upstream = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: MODEL,
                    temperature: 0.2,
                    max_tokens: 800,
                    messages: convo,
                    tools: TOOLS,
                    tool_choice: 'auto'
                })
            });
        }
        catch (err) {
            safeError('admin-assistant fetch failed', err);
            res.status(502).json({ message: 'Could not reach the model.' });
            return;
        }
        if (!upstream.ok) {
            const errText = await upstream.text();
            safeError(`admin-assistant openai ${upstream.status}`, errText.slice(0, 400));
            res.status(502).json({ message: 'Upstream model error.' });
            return;
        }
        const data = (await upstream.json());
        const choice = data.choices[0];
        if (!choice) {
            res.status(502).json({ message: 'Empty model response.' });
            return;
        }
        const msg = choice.message;
        convo.push(msg);
        if (msg.tool_calls && msg.tool_calls.length > 0) {
            for (const call of msg.tool_calls) {
                let argsObj = {};
                try {
                    argsObj = JSON.parse(call.function.arguments);
                }
                catch {
                    argsObj = {};
                }
                let toolResult;
                try {
                    toolResult = await runTool(call.function.name, argsObj, ctx);
                }
                catch (err) {
                    safeError(`admin-assistant tool ${call.function.name} failed`, err);
                    toolResult = { error: 'tool execution failed' };
                }
                convo.push({
                    role: 'tool',
                    tool_call_id: call.id,
                    content: JSON.stringify(toolResult)
                });
            }
            continue;
        }
        const text = (msg.content ?? '').trim();
        if (!text) {
            res.status(502).json({ message: 'Empty model response.' });
            return;
        }
        try {
            const ip = (req.header('cf-connecting-ip') ?? req.ip ?? null);
            await db('support_conversations').insert([
                {
                    id: randomUUID(),
                    session_id: sessionId,
                    role: 'user',
                    content: messages[messages.length - 1].content,
                    model: MODEL,
                    ip_address: ip
                },
                {
                    id: randomUUID(),
                    session_id: sessionId,
                    role: 'assistant',
                    content: text,
                    model: MODEL,
                    ip_address: ip
                }
            ]);
        }
        catch (err) {
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
//# sourceMappingURL=admin-assistant-routes.js.map