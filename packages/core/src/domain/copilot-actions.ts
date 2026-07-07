/**
 * Copilot Action vocabulary.
 *
 * Defines the typed actions the AI Workflow Copilot can propose AND that
 * the action runner knows how to execute. Each action is a discriminated
 * union member keyed by `type`.
 *
 * Adding a new action:
 *   1. Define its Zod schema below, with a `type` literal
 *   2. Add it to copilotActionSchema discriminated union
 *   3. Add an executor in packages/app/src/services/copilot-action-executor.ts
 *
 * The schema lives in core so the LLM-side prompt-builder, the UI's
 * confirm-block renderer, and the backend executor all reference the same
 * shape. If the schema changes, all three need a coordinated update, that's
 * intentional.
 */

import { z } from 'zod'

// ----- enroll_caregiver -----
// Assigns a caregiver to a course. Wraps POST /api/learning/enroll.

export const enrollCaregiverActionSchema = z.object({
  type: z.literal('enroll_caregiver'),
  caregiverId: z.string().uuid(),
  courseId: z.string().uuid(),
  dueAt: z.string().datetime().nullable().default(null),
  /** Coordinator/admin-supplied context shown in audit log + reminder copy. */
  reason: z.string().max(500).default(''),
})
export type EnrollCaregiverAction = z.infer<typeof enrollCaregiverActionSchema>

// ----- send_reminder -----
// Stub for v2, logs the intent + writes audit, but doesn't actually send.
// Real send (email/push) wires up when the notification service is in place.

export const sendReminderActionSchema = z.object({
  type: z.literal('send_reminder'),
  caregiverId: z.string().uuid(),
  channel: z.enum(['email', 'push', 'both']).default('email'),
  message: z.string().min(1).max(500),
})
export type SendReminderAction = z.infer<typeof sendReminderActionSchema>

// ----- Discriminated union -----

export const copilotActionSchema = z.discriminatedUnion('type', [
  enrollCaregiverActionSchema,
  sendReminderActionSchema,
])
export type CopilotAction = z.infer<typeof copilotActionSchema>

// ----- Execution result envelope -----
// Returned by the executor; the route serializes this back to the client.

export interface CopilotActionResult {
  /** Echo of the action that ran, after schema-level defaults applied. */
  action: CopilotAction
  /** Action-specific outcome data, caller can render or ignore. */
  outcome: Record<string, unknown>
  /** Human-readable summary for the UI. */
  summary: string
}

// ----- Helper: human-readable label for UI rendering -----

export function describeAction(action: CopilotAction): string {
  switch (action.type) {
    case 'enroll_caregiver':
      return `Enroll caregiver ${action.caregiverId.slice(0, 6)}… in course ${action.courseId.slice(0, 6)}…${action.dueAt ? ` (due ${action.dueAt.slice(0, 10)})` : ''}`
    case 'send_reminder':
      return `Send ${action.channel} reminder to caregiver ${action.caregiverId.slice(0, 6)}…`
  }
}
