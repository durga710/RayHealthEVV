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
import type { Knex } from 'knex';
import { type CopilotAction, type CopilotActionResult } from '@rayhealth/core';
export interface ExecutionContext {
    db: Knex;
    /** The actor's agency — used to scope every repository read. */
    agencyId: string;
    /** The actor's role — used to gate elevated actions. */
    actorRole: 'admin' | 'coordinator' | 'caregiver' | 'family';
    /** The actor's user id — written to audit payload. */
    actorUserId: string;
}
export declare class ActionAuthorizationError extends Error {
    constructor(message: string);
}
export declare class ActionExecutionError extends Error {
    constructor(message: string);
}
/**
 * Top-level dispatch. Picks an executor by action.type and runs it.
 */
export declare function executeCopilotAction(action: CopilotAction, ctx: ExecutionContext): Promise<CopilotActionResult>;
//# sourceMappingURL=copilot-action-executor.d.ts.map