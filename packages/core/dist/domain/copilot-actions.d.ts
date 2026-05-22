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
 * shape. If the schema changes, all three need a coordinated update — that's
 * intentional.
 */
import { z } from 'zod';
export declare const enrollCaregiverActionSchema: z.ZodObject<{
    type: z.ZodLiteral<"enroll_caregiver">;
    caregiverId: z.ZodString;
    courseId: z.ZodString;
    dueAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    reason: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type EnrollCaregiverAction = z.infer<typeof enrollCaregiverActionSchema>;
export declare const sendReminderActionSchema: z.ZodObject<{
    type: z.ZodLiteral<"send_reminder">;
    caregiverId: z.ZodString;
    channel: z.ZodDefault<z.ZodEnum<{
        email: "email";
        push: "push";
        both: "both";
    }>>;
    message: z.ZodString;
}, z.core.$strip>;
export type SendReminderAction = z.infer<typeof sendReminderActionSchema>;
export declare const copilotActionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"enroll_caregiver">;
    caregiverId: z.ZodString;
    courseId: z.ZodString;
    dueAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    reason: z.ZodDefault<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"send_reminder">;
    caregiverId: z.ZodString;
    channel: z.ZodDefault<z.ZodEnum<{
        email: "email";
        push: "push";
        both: "both";
    }>>;
    message: z.ZodString;
}, z.core.$strip>], "type">;
export type CopilotAction = z.infer<typeof copilotActionSchema>;
export interface CopilotActionResult {
    /** Echo of the action that ran, after schema-level defaults applied. */
    action: CopilotAction;
    /** Action-specific outcome data — caller can render or ignore. */
    outcome: Record<string, unknown>;
    /** Human-readable summary for the UI. */
    summary: string;
}
export declare function describeAction(action: CopilotAction): string;
//# sourceMappingURL=copilot-actions.d.ts.map