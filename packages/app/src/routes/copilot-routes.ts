/**
 * AI Workflow Copilot routes.
 *
 *   GET  /copilot/status     — has the agency enabled the add-on + is an AI provider configured
 *   POST /copilot/ask        — answer a conversational question with role-appropriate context
 *
 * Gating:
 *   - All routes require an authenticated user.
 *   - /ask additionally requires agencyFeatures.aiCopilot.enabled = true.
 *
 * Audit:
 *   - Every /ask writes a copilot.query audit event with the prompt hash
 *     (not the prompt itself — prompts can contain PHI; hashes give a
 *     correlation ID without retention liability) and the model used.
 */

import { createHash } from 'node:crypto'
import { Router, type Request, type Response } from 'express'
import type { Knex } from 'knex'
import {
  AuditEventRepository,
  copilotActionSchema,
  parseAgencyFeatures,
  type AgencyFeatures,
  type AppRole,
} from '@rayhealth/core'
import { askAI, isAIConfigured, AINotConfiguredError } from '../ai.js'
import {
  ActionAuthorizationError,
  ActionExecutionError,
  executeCopilotAction,
} from '../services/copilot-action-executor.js'
import { buildCopilotContext, contextSizeSummary } from '../services/copilot-context.js'

const router = Router()

async function readFeatures(req: Request): Promise<AgencyFeatures> {
  const db = req.app.get('db') as Knex | undefined
  if (!db) return parseAgencyFeatures(undefined)
  const row = (await db('agencies').where({ id: req.auth.agencyId }).first('features')) as
    | { features?: unknown }
    | undefined
  return parseAgencyFeatures(row?.features)
}

// ---------- Status ----------

router.get('/status', async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ success: false, error: 'unauthenticated' })
    return
  }
  try {
    const features = await readFeatures(req)
    res.json({
      success: true,
      data: {
        enabled: features.aiCopilot.enabled,
        plan: features.aiCopilot.plan,
        // True when the (BAA-covered, Bedrock-only) AI provider is configured.
        aiConfigured: isAIConfigured(),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unexpected error'
    res.status(500).json({ success: false, error: message })
  }
})

// ---------- Role-based system prompts ----------

const SYSTEM_PROMPTS: Record<AppRole, string> = {
  admin: `You are the RayHealth EVV agency owner's copilot. You help the owner run their home-care agency.
You see the full picture: compliance posture, training, scheduling, billing readiness, BAAs.
When you propose an action — assigning a caregiver, sending a reminder, exporting a CSV — describe it
in plain English and END YOUR RESPONSE WITH two lines in this exact format:
  PROPOSE_ACTION: <short imperative sentence>
  PROPOSE_ACTION_DATA: <JSON object>
Where PROPOSE_ACTION_DATA is one of:
  {"type": "enroll_caregiver", "caregiverId": "<UUID>", "courseId": "<UUID>", "dueAt": "<ISO date or null>"}
  {"type": "send_reminder", "caregiverId": "<UUID>", "channel": "email|push|both", "message": "<text>"}
The user message will be preceded by an "Agency context" JSON blob listing every
available caregiver and course with its real UUID — use those exact UUIDs in
PROPOSE_ACTION_DATA. Match free-text names to UUIDs by case-insensitive
substring match on the caregiver name field. If you cannot find a match, skip
the PROPOSE_ACTION_DATA line and only emit PROPOSE_ACTION as plain English.
The owner will confirm before anything is executed. Never imply you have already done something.
You are factual, concise, and decline to speculate about specific caregiver behavior or motivation.`,

  coordinator: `You are the RayHealth EVV coordinator's copilot. You help schedule visits, manage assignments,
flag compliance gaps, and prep for audits. You see caregivers, clients, visit templates, and the
Learning Hub state for the agency.
When you propose an action, end your response with:
  PROPOSE_ACTION: <short imperative sentence>
The coordinator will confirm before execution. Never imply an action has already happened.
Stay factual; avoid speculating about a caregiver's reasons.`,

  caregiver: `You are the RayHealth EVV caregiver's copilot. You help the caregiver answer questions about
their own assigned visits, their own training, and their own schedule. You DO NOT have access to
any other caregiver's data.
You can propose: marking a course complete, requesting time off, asking the coordinator about a visit.
End any proposal with:
  PROPOSE_ACTION: <short imperative sentence>
You are warm, plain-spoken, and never preachy about compliance.`,

  family: `You are the RayHealth EVV family-portal copilot. You help the family member of a client
understand visits, caregiver arrival times, and visit notes for the specific client they are
authorized to view. You have read-only access. Do not discuss other clients, other caregivers,
agency finances, or HR matters. If asked about something outside scope, politely redirect.`,
}

// ---------- Ask ----------

interface AskBody {
  prompt?: string
}

router.post('/ask', async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ success: false, error: 'unauthenticated' })
    return
  }

  const body = (req.body ?? {}) as AskBody
  const prompt = (body.prompt ?? '').trim()
  if (!prompt) {
    res.status(400).json({ success: false, error: 'prompt is required' })
    return
  }
  if (prompt.length > 4000) {
    res.status(400).json({ success: false, error: 'prompt exceeds 4000 characters' })
    return
  }

  try {
    const features = await readFeatures(req)
    if (!features.aiCopilot.enabled) {
      res.status(402).json({
        success: false,
        code: 'COPILOT_NOT_ENABLED',
        error: 'AI Copilot add-on is not enabled for this agency. Ask an admin to enable it in Settings.',
      })
      return
    }
    if (!isAIConfigured()) {
      res.status(503).json({
        success: false,
        code: 'COPILOT_NOT_CONFIGURED',
        error: 'Copilot infrastructure is offline. Try again later.',
      })
      return
    }

    const role = req.auth.role as AppRole
    const systemInstruction = SYSTEM_PROMPTS[role] ?? SYSTEM_PROMPTS.coordinator
    const tier: 'starter' | 'pro' = features.aiCopilot.plan === 'pro' ? 'pro' : 'starter'

    // Build the per-request context blob so the model has real UUIDs to
    // reference when emitting PROPOSE_ACTION_DATA. Failures degrade to an
    // empty blob — the model can still answer questions, it just won't have
    // structured action proposals.
    const db = req.app.get('db') as Knex
    const context = await buildCopilotContext({
      db,
      agencyId: req.auth.agencyId,
      role,
      callerCaregiverId: req.auth.caregiverId,
    })

    const enrichedPrompt = context.text
      ? `${context.text}\n\nUser question:\n${prompt}`
      : prompt

    const result = await askAI({
      prompt: enrichedPrompt,
      systemInstruction,
      tier,
    })

    // Parse out the trailing PROPOSE_ACTION (plain English) and optional
    // PROPOSE_ACTION_DATA (structured JSON) lines. The data line is
    // validated against copilotActionSchema — if invalid we drop it and
    // keep the natural-language proposal so the UI can still show
    // advisory-mode confirm/decline.
    const actionMatch = /\bPROPOSE_ACTION:\s*(.+?)\s*$/m.exec(result.text)
    const dataMatch = /\bPROPOSE_ACTION_DATA:\s*(\{[^\n]+\})/m.exec(result.text)

    const proposedAction = actionMatch ? actionMatch[1].trim() : null
    let proposedActionData: import('@rayhealth/core').CopilotAction | null = null
    if (dataMatch) {
      try {
        const candidate = JSON.parse(dataMatch[1])
        const validated = copilotActionSchema.safeParse(candidate)
        if (validated.success) {
          proposedActionData = validated.data
        }
      } catch {
        /* invalid JSON — leave proposedActionData null */
      }
    }

    // Strip both lines from the human-facing answer.
    let answerText = result.text
    if (actionMatch) answerText = answerText.replace(actionMatch[0], '').trim()
    if (dataMatch) answerText = answerText.replace(dataMatch[0], '').trim()

    // Audit the query. We hash the prompt rather than store it — prompts can
    // contain PHI, hashes give a forensic correlation ID without retention.
    const promptHash = createHash('sha256').update(prompt).digest('hex').slice(0, 32)
    try {
      const auditRepo = new AuditEventRepository(db)
      await auditRepo.create({
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'copilot.query',
        entityType: 'agency',
        entityId: req.auth.agencyId,
        outcome: 'success',
        payload: {
          role,
          model: result.model,
          plan: features.aiCopilot.plan,
          promptHash,
          promptLength: prompt.length,
          usageTokens: result.usageTokens,
          proposedAction: proposedAction ?? null,
          proposedActionType: proposedActionData?.type ?? null,
          contextSize: contextSizeSummary(context),
        },
      })
    } catch (auditErr: unknown) {
      process.stderr.write(
        `[audit-write-failed] copilot.query err=${auditErr instanceof Error ? auditErr.message : 'unknown'}\n`,
      )
    }

    res.json({
      success: true,
      data: {
        answer: answerText,
        proposedAction,
        proposedActionData,
        model: result.model,
        usageTokens: result.usageTokens,
      },
    })
  } catch (error: unknown) {
    if (error instanceof AINotConfiguredError) {
      res.status(503).json({ success: false, code: 'COPILOT_NOT_CONFIGURED', error: error.message })
      return
    }
    // A thrown error from the model provider (Bedrock) is an upstream
    // failure, not a bug in our handler — surface it as 502 so the client can
    // distinguish "try again" from a hard 500.
    const message = error instanceof Error ? error.message : 'unexpected error'
    res.status(502).json({ success: false, code: 'COPILOT_UPSTREAM_ERROR', error: message })
  }
})

// ---------- Execute (v2 action runner) ----------

router.post('/execute', async (req: Request, res: Response) => {
  if (!req.auth) {
    res.status(401).json({ success: false, error: 'unauthenticated' })
    return
  }

  const parsed = copilotActionSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'action payload failed validation',
      details: parsed.error.issues,
    })
    return
  }
  const action = parsed.data

  try {
    const features = await readFeatures(req)
    if (!features.aiCopilot.enabled) {
      res.status(402).json({
        success: false,
        code: 'COPILOT_NOT_ENABLED',
        error: 'AI Copilot add-on is not enabled for this agency.',
      })
      return
    }

    const db = req.app.get('db') as Knex
    const result = await executeCopilotAction(action, {
      db,
      agencyId: req.auth.agencyId,
      actorRole: req.auth.role as AppRole,
      actorUserId: req.auth.userId,
    })

    // Audit the confirmed action with the result summary.
    try {
      const auditRepo = new AuditEventRepository(db)
      await auditRepo.create({
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'copilot.action.confirmed',
        entityType: 'copilot_action',
        entityId: req.auth.agencyId,
        outcome: 'success',
        payload: {
          actionType: action.type,
          action,
          summary: result.summary,
          outcome: result.outcome,
        },
      })
    } catch (auditErr: unknown) {
      process.stderr.write(
        `[audit-write-failed] copilot.action.confirmed err=${auditErr instanceof Error ? auditErr.message : 'unknown'}\n`,
      )
    }

    res.json({ success: true, data: result })
  } catch (error: unknown) {
    // Audit declined/failed actions so the trail captures every attempt.
    const db = req.app.get('db') as Knex | undefined
    if (db) {
      try {
        const auditRepo = new AuditEventRepository(db)
        await auditRepo.create({
          agencyId: req.auth.agencyId,
          actorId: req.auth.userId,
          actorType: 'user',
          eventType: 'copilot.action.declined',
          entityType: 'copilot_action',
          entityId: req.auth.agencyId,
          outcome: 'failure',
          payload: {
            actionType: action.type,
            action,
            reason: error instanceof Error ? error.message : 'unknown error',
          },
        })
      } catch {
        /* swallow — we're already in the error path */
      }
    }

    if (error instanceof ActionAuthorizationError) {
      res.status(403).json({ success: false, error: error.message })
      return
    }
    if (error instanceof ActionExecutionError) {
      res.status(422).json({ success: false, error: error.message })
      return
    }
    const message = error instanceof Error ? error.message : 'unexpected error'
    res.status(500).json({ success: false, error: message })
  }
})

export default router
