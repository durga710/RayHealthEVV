/**
 * Repository for the `agency_hhaexchange_config` table.
 *
 * Stores per-agency HHAeXchange identity (Tax ID, Provider ID, timezone) plus
 * the per-caregiver and per-service mappings as JSONB. Parallel in shape to
 * the Sandata config (which doesn't have its own repo yet — reads/writes go
 * through `sandata-mapping.ts` + ad-hoc knex).
 *
 * The JSONB payloads are validated against the existing
 * `hhaexchangeCaregiverMappingSchema` / `hhaexchangeServiceMappingSchema` Zod
 * schemas exported from `services/hhaexchange-mapping.ts`. Invalid stored
 * data degrades gracefully — `readConfig()` returns the row with the bad
 * arrays replaced by empty arrays so the application can still load.
 */
import type { Knex } from 'knex';
import { type HhaexchangeCaregiverMapping, type HhaexchangeConfig, type HhaexchangeServiceMapping } from '../services/hhaexchange-mapping.js';
export interface PartialHhaexchangeConfig {
    agencyId: string;
    agencyTaxId: string | null;
    hhaProviderId: string | null;
    timezone: string;
    caregivers: HhaexchangeCaregiverMapping[];
    services: HhaexchangeServiceMapping[];
    enabled: boolean;
}
export declare class AgencyHhaexchangeConfigRepository {
    private readonly db;
    constructor(db: Knex);
    /** Returns the partial row (may have nullable identity fields). */
    findByAgency(agencyId: string): Promise<PartialHhaexchangeConfig | undefined>;
    /** Returns the fully-typed config only when both Tax ID and Provider ID
     * are present. Use this in the export pipeline — emitting an HHAeXchange
     * row without these fields would be rejected by the aggregator. */
    findValid(agencyId: string): Promise<HhaexchangeConfig | undefined>;
    upsert(input: PartialHhaexchangeConfig): Promise<PartialHhaexchangeConfig>;
}
//# sourceMappingURL=agency-hhaexchange-config-repository.d.ts.map