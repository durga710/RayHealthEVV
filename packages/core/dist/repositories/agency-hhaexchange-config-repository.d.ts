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
import type { IntegrationCredentials } from '../integrations/types.js';
import type { HhaexchangeClientConfig } from '../integrations/hhaexchange-client.js';
export interface PartialHhaexchangeConfig {
    agencyId: string;
    agencyTaxId: string | null;
    hhaProviderId: string | null;
    timezone: string;
    caregivers: HhaexchangeCaregiverMapping[];
    services: HhaexchangeServiceMapping[];
    enabled: boolean;
    apiBaseUrl: string | null;
    /** Read-only indicator — plaintext credentials are never returned to callers. */
    hasCredentials: boolean;
}
/**
 * Upsert input. `credentials` is write-only and tri-state:
 *   undefined → leave the stored credentials unchanged
 *   null      → clear the stored credentials
 *   object    → encrypt (AES-256-GCM) and store
 */
export interface HhaexchangeConfigUpsert {
    agencyId: string;
    agencyTaxId: string | null;
    hhaProviderId: string | null;
    timezone: string;
    caregivers: HhaexchangeCaregiverMapping[];
    services: HhaexchangeServiceMapping[];
    enabled: boolean;
    apiBaseUrl?: string | null;
    credentials?: IntegrationCredentials | null;
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
    /**
     * Returns the full submission config WITH decrypted credentials — for the
     * HHAeXchange client only. Never expose this to an API response; the admin UI
     * uses `findByAgency` (which carries `hasCredentials`, not the secret).
     */
    findSubmissionConfig(agencyId: string): Promise<HhaexchangeClientConfig | undefined>;
    upsert(input: HhaexchangeConfigUpsert): Promise<PartialHhaexchangeConfig>;
}
//# sourceMappingURL=agency-hhaexchange-config-repository.d.ts.map