/**
 * Agency HHAeXchange config routes.
 *
 *   GET  /agencies/me/hhaexchange-config  — read the agency's HHAeXchange identity
 *                                            + mappings (returns nullable identity
 *                                            fields when the agency is mid-onboarding)
 *   PUT  /agencies/me/hhaexchange-config  — admin-only update
 *
 * The PUT validates against the existing
 * `hhaexchangeCaregiverMappingSchema` / `hhaexchangeServiceMappingSchema`
 * Zod schemas so caregivers/services that the agency has never mapped get
 * rejected cleanly — the EVV export pipeline can then trust that a stored
 * config has well-formed mappings.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=agency-hhaexchange-config-routes.d.ts.map