/**
 * Agency Sandata config routes.
 *
 *   GET  /agencies/me/sandata-config   — read identity + mappings (nullable identity allowed)
 *   PUT  /agencies/me/sandata-config   — admin-only update
 *
 * Sibling to `agency-hhaexchange-config-routes.ts`. Validates the per-mapping
 * shapes with the existing Zod schemas from `services/sandata-mapping.ts`
 * (caregivers are UUID + external worker ID; services are HCPCS code +
 * modifier + label). Refuses `enabled=true` until provider_id is populated.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=agency-sandata-config-routes.d.ts.map