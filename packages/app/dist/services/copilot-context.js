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
import { CaregiverRepository, LearningRepository, } from '@rayhealth/core';
const MAX_CAREGIVERS = 50;
/**
 * Gather the structured context for this caller. Pure read — never mutates.
 * Failures are caught and degrade to an empty context so a transient DB hiccup
 * doesn't take the copilot offline.
 */
export async function buildCopilotContext(opts) {
    if (opts.role === 'family') {
        return { text: '', caregivers: [], courses: [] };
    }
    const caregiverRepo = new CaregiverRepository(opts.db);
    const learningRepo = new LearningRepository(opts.db);
    let caregivers = [];
    let courses = [];
    try {
        if (opts.role === 'caregiver') {
            // Caregivers see only their own record and their own course catalog.
            if (opts.callerCaregiverId) {
                const self = await caregiverRepo.findById(opts.callerCaregiverId, opts.agencyId);
                if (self)
                    caregivers = [self];
            }
            courses = await learningRepo.listCourses(opts.agencyId);
        }
        else {
            // Admin / coordinator: see active caregivers + full course catalog.
            const all = await caregiverRepo.findByAgency(opts.agencyId);
            caregivers = all.filter((c) => c.status === 'active').slice(0, MAX_CAREGIVERS);
            courses = await learningRepo.listCourses(opts.agencyId);
        }
    }
    catch (error) {
        process.stderr.write(`[copilot-context] degraded: ${error instanceof Error ? error.message : 'unknown'}\n`);
        return { text: '', caregivers: [], courses: [] };
    }
    // `id` on the domain schemas is technically optional (new entities pre-insert
    // have no UUID yet) but in practice anything returned from a repository
    // already has one. Filter defensively so the UUID-typed summaries stay
    // honest — a row missing an ID is useless to the model anyway.
    const caregiverSummaries = caregivers
        .filter((c) => typeof c.id === 'string' && c.id.length > 0)
        .map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        status: c.status ?? 'active',
    }));
    const courseSummaries = courses
        .filter((c) => typeof c.id === 'string' && c.id.length > 0)
        .map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        required: c.required,
    }));
    return {
        text: renderContextText(caregiverSummaries, courseSummaries),
        caregivers: caregiverSummaries,
        courses: courseSummaries,
    };
}
function renderContextText(caregivers, courses) {
    if (caregivers.length === 0 && courses.length === 0) {
        return '';
    }
    // Stable, machine-readable layout. The leading sentence explains to the
    // model what to do with it; the JSON gives it the IDs it needs.
    const lines = [
        'Agency context for this conversation (use these exact UUIDs when emitting PROPOSE_ACTION_DATA):',
        '```json',
        JSON.stringify({ caregivers, courses }, null, 2),
        '```',
    ];
    return lines.join('\n');
}
/** Number of context items used in the blob — handy for audit payloads. */
export function contextSizeSummary(context) {
    return {
        caregivers: context.caregivers.length,
        courses: context.courses.length,
    };
}
//# sourceMappingURL=copilot-context.js.map