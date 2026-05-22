/**
 * AI Workflow Copilot routes.
 *
 *   GET  /copilot/status     — has the agency enabled the add-on + is Gemini configured
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
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=copilot-routes.d.ts.map