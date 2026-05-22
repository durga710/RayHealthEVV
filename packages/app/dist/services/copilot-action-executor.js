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
 * `copilot.action.declined` (with the error message) on failure — but the
 * executor itself never writes audit. Keeps the executor pure-ish and the
 * route in charge of side-effect logging.
 */
import { CaregiverRepository, LearningRepository, } from '@rayhealth/core';
export class ActionAuthorizationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ActionAuthorizationError';
    }
}
export class ActionExecutionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ActionExecutionError';
    }
}
/**
 * Top-level dispatch. Picks an executor by action.type and runs it.
 */
export async function executeCopilotAction(action, ctx) {
    switch (action.type) {
        case 'enroll_caregiver':
            return executeEnrollCaregiver(action, ctx);
        case 'send_reminder':
            return executeSendReminder(action, ctx);
    }
}
// ---------- enroll_caregiver ----------
async function executeEnrollCaregiver(action, ctx) {
    if (ctx.actorRole !== 'admin' && ctx.actorRole !== 'coordinator') {
        throw new ActionAuthorizationError('Only admins and coordinators can enroll caregivers in courses.');
    }
    // Verify caregiver is in this agency.
    const caregiverRepo = new CaregiverRepository(ctx.db);
    const caregiver = await caregiverRepo.findById(action.caregiverId, ctx.agencyId);
    if (!caregiver) {
        throw new ActionExecutionError(`Caregiver ${action.caregiverId} not found.`);
    }
    if (caregiver.agencyId !== ctx.agencyId) {
        throw new ActionAuthorizationError('Caregiver belongs to a different agency.');
    }
    // Verify course is visible to this agency (global or agency-owned).
    const learningRepo = new LearningRepository(ctx.db);
    const course = await learningRepo.findCourseById(action.courseId);
    if (!course) {
        throw new ActionExecutionError(`Course ${action.courseId} not found.`);
    }
    if (course.agencyId !== null && course.agencyId !== ctx.agencyId) {
        throw new ActionAuthorizationError('Course belongs to a different agency.');
    }
    // Enroll via the existing repository. Idempotent — re-running on an
    // already-enrolled caregiver returns the existing enrollment.
    const enrollment = await learningRepo.enroll({
        agencyId: ctx.agencyId,
        caregiverId: action.caregiverId,
        courseId: action.courseId,
        dueAt: action.dueAt,
    });
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
    };
}
// ---------- send_reminder ----------
// Stub for v2 — logs the intent + returns a synthetic outcome. Real send
// (email/push) wires up when the notification service exists.
async function executeSendReminder(action, ctx) {
    if (ctx.actorRole !== 'admin' && ctx.actorRole !== 'coordinator') {
        throw new ActionAuthorizationError('Only admins and coordinators can send caregiver reminders.');
    }
    const caregiverRepo = new CaregiverRepository(ctx.db);
    const caregiver = await caregiverRepo.findById(action.caregiverId, ctx.agencyId);
    if (!caregiver) {
        throw new ActionExecutionError(`Caregiver ${action.caregiverId} not found.`);
    }
    if (caregiver.agencyId !== ctx.agencyId) {
        throw new ActionAuthorizationError('Caregiver belongs to a different agency.');
    }
    // v2 STUB: notification service is not yet wired. We record the intent
    // and audit it; v3 will dispatch through the real notification pipeline.
    process.stderr.write(`[copilot-action-stub] send_reminder caregiver=${action.caregiverId} ` +
        `channel=${action.channel} length=${action.message.length}\n`);
    return {
        action,
        outcome: {
            simulated: true,
            caregiverName: `${caregiver.firstName} ${caregiver.lastName}`,
            channel: action.channel,
        },
        summary: `Queued ${action.channel} reminder for ${caregiver.firstName} ${caregiver.lastName} (notification service v3)`,
    };
}
//# sourceMappingURL=copilot-action-executor.js.map