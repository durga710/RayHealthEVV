/**
 * Copilot Action Executor.
 *
 * Dispatches a validated CopilotAction to the right side-effect. Each
 * executor:
 *   - Validates row-level authorization (caregiver belongs to actor's agency, etc.)
 *   - Performs the action via existing repositories (no new DB layer)
 *   - Returns a CopilotActionResult with a human-readable summary
 *
 * The route handler wraps every execution in a try/catch and writes a
 * `copilot.action.confirmed` audit event on success or
 * `copilot.action.declined` (with the error message) on failure, but the
 * executor itself never writes audit. Keeps the executor pure-ish and the
 * route in charge of side-effect logging.
 */

import type { Knex } from 'knex'
import {
  AgencyRepository,
  CaregiverRepository,
  LearningRepository,
  type CopilotAction,
  type CopilotActionResult,
} from '@rayhealth/core'
import { createEmailClient } from '../email/email-client.js'

export interface ExecutionContext {
  db: Knex
  /** The actor's agency, used to scope every repository read. */
  agencyId: string
  /** The actor's role, used to gate elevated actions. */
  actorRole: 'admin' | 'coordinator' | 'caregiver' | 'family'
  /** The actor's user id, written to audit payload. */
  actorUserId: string
}

export class ActionAuthorizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActionAuthorizationError'
  }
}

export class ActionExecutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ActionExecutionError'
  }
}

/**
 * Top-level dispatch. Picks an executor by action.type and runs it.
 */
export async function executeCopilotAction(
  action: CopilotAction,
  ctx: ExecutionContext,
): Promise<CopilotActionResult> {
  switch (action.type) {
    case 'enroll_caregiver':
      return executeEnrollCaregiver(action, ctx)
    case 'send_reminder':
      return executeSendReminder(action, ctx)
  }
}

// ---------- enroll_caregiver ----------

async function executeEnrollCaregiver(
  action: CopilotAction & { type: 'enroll_caregiver' },
  ctx: ExecutionContext,
): Promise<CopilotActionResult> {
  if (ctx.actorRole !== 'admin' && ctx.actorRole !== 'coordinator') {
    throw new ActionAuthorizationError(
      'Only admins and coordinators can enroll caregivers in courses.',
    )
  }

  // Verify caregiver is in this agency.
  const caregiverRepo = new CaregiverRepository(ctx.db)
  const caregiver = await caregiverRepo.findById(action.caregiverId, ctx.agencyId)
  if (!caregiver) {
    throw new ActionExecutionError(`Caregiver ${action.caregiverId} not found.`)
  }
  if (caregiver.agencyId !== ctx.agencyId) {
    throw new ActionAuthorizationError('Caregiver belongs to a different agency.')
  }

  // Verify course is visible to this agency (global or agency-owned).
  const learningRepo = new LearningRepository(ctx.db)
  const course = await learningRepo.findCourseById(action.courseId)
  if (!course) {
    throw new ActionExecutionError(`Course ${action.courseId} not found.`)
  }
  if (course.agencyId !== null && course.agencyId !== ctx.agencyId) {
    throw new ActionAuthorizationError('Course belongs to a different agency.')
  }

  // Enroll via the existing repository. Idempotent, re-running on an
  // already-enrolled caregiver returns the existing enrollment.
  const enrollment = await learningRepo.enroll({
    agencyId: ctx.agencyId,
    caregiverId: action.caregiverId,
    courseId: action.courseId,
    dueAt: action.dueAt,
  })

  return {
    action,
    outcome: {
      enrollmentId: enrollment.id,
      idempotent: enrollment.assignedAt !== undefined, // existing or newly-created
      courseTitle: course.title,
      caregiverName: `${caregiver.firstName} ${caregiver.lastName}`,
    },
    summary: `${caregiver.firstName} ${caregiver.lastName} enrolled in ${course.title}` +
      (action.dueAt ? ` (due ${action.dueAt.slice(0, 10)})` : ''),
  }
}

// ---------- send_reminder ----------
// Dispatches a real reminder. Email delivery is live (via the configured email
// provider. SMTP/Resend/SES). Push delivery is not built yet, so a push-only
// request is declined honestly rather than silently "queued".

async function executeSendReminder(
  action: CopilotAction & { type: 'send_reminder' },
  ctx: ExecutionContext,
): Promise<CopilotActionResult> {
  if (ctx.actorRole !== 'admin' && ctx.actorRole !== 'coordinator') {
    throw new ActionAuthorizationError(
      'Only admins and coordinators can send caregiver reminders.',
    )
  }

  const caregiverRepo = new CaregiverRepository(ctx.db)
  const caregiver = await caregiverRepo.findById(action.caregiverId, ctx.agencyId)
  if (!caregiver) {
    throw new ActionExecutionError(`Caregiver ${action.caregiverId} not found.`)
  }
  if (caregiver.agencyId !== ctx.agencyId) {
    throw new ActionAuthorizationError('Caregiver belongs to a different agency.')
  }

  const wantsEmail = action.channel === 'email' || action.channel === 'both'
  const wantsPush = action.channel === 'push' || action.channel === 'both'
  const caregiverName = `${caregiver.firstName} ${caregiver.lastName}`

  // Push delivery isn't wired yet. Be explicit instead of pretending.
  if (action.channel === 'push') {
    throw new ActionExecutionError(
      'Push reminders are not available yet. Ask me to send an email reminder instead.',
    )
  }

  let emailMessageId: string | undefined
  if (wantsEmail) {
    if (!caregiver.email) {
      throw new ActionExecutionError(`${caregiverName} has no email address on file.`)
    }
    const agency = await new AgencyRepository(ctx.db).findById(ctx.agencyId)
    const result = await createEmailClient().sendReminderEmail({
      to: caregiver.email,
      caregiverName,
      message: action.message,
      agencyName: agency?.name ?? 'Your agency',
    })
    if (!result.ok) {
      throw new ActionExecutionError(
        result.error === 'EMAIL_NOT_CONFIGURED'
          ? 'Email delivery is not configured for this environment.'
          : `Email delivery failed (${result.error}).`,
      )
    }
    emailMessageId = result.id
  }

  return {
    action,
    outcome: {
      caregiverName,
      channel: action.channel,
      emailDelivered: wantsEmail,
      emailMessageId,
      // 'both' delivers the email now; push portion is noted as pending.
      pushPending: wantsPush,
    },
    summary:
      `Emailed a reminder to ${caregiverName}` +
      (wantsPush ? ' (push delivery is coming soon)' : ''),
  }
}
