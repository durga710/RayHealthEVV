/**
 * Builds the per-request context blob injected into Copilot prompts so the
 * model can propose typed actions with real UUIDs.
 *
 * Without this, the system prompt tells the model to "only emit a JSON action
 * line when you have real UUIDs from prior conversation context" — and since
 * there is no prior conversation context, the model never emits one, so the
 * structured-action runner stays dead code in practice.
 *
 * We deliberately keep the blob tight to bound prompt-token cost:
 *   - admin/coordinator: up to 50 active caregivers + all agency courses
 *   - caregiver:         only their own profile + their own enrollments
 *   - family:            no caregiver/course context — they only see visits
 *                        for a single client, which is queried elsewhere
 *
 * The blob is serialized as JSON inside a fenced block so Gemini parses it as
 * structured data rather than freeform prose. Names are included so the model
 * can resolve a free-text mention like "Maria" to a UUID without a round-trip.
 */
import type { Knex } from 'knex';
import { type AppRole } from '@rayhealth/core';
interface CaregiverSummary {
    id: string;
    name: string;
    status: string;
}
interface CourseSummary {
    id: string;
    code: string;
    title: string;
    required: boolean;
}
export interface CopilotContext {
    /** Compact text to inject before the user prompt. Empty string when the
     * role has no shareable context (e.g. family role). */
    text: string;
    /** Structured form — exposed for tests and for future tool-calling APIs
     * that may want the raw shape rather than the rendered text. */
    caregivers: CaregiverSummary[];
    courses: CourseSummary[];
}
export interface CopilotContextOptions {
    db: Knex;
    agencyId: string;
    role: AppRole;
    /** When the caller is a caregiver themselves, only their own record is
     * surfaced. For admin/coordinator this is ignored. */
    callerCaregiverId?: string;
}
/**
 * Gather the structured context for this caller. Pure read — never mutates.
 * Failures are caught and degrade to an empty context so a transient DB hiccup
 * doesn't take the copilot offline.
 */
export declare function buildCopilotContext(opts: CopilotContextOptions): Promise<CopilotContext>;
/** Number of context items used in the blob — handy for audit payloads. */
export declare function contextSizeSummary(context: CopilotContext): {
    caregivers: number;
    courses: number;
};
export {};
//# sourceMappingURL=copilot-context.d.ts.map