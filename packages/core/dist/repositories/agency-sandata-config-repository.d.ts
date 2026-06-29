/**
 * Repository for the `agency_sandata_config` table.
 *
 * Parallel in shape to `AgencyHhaexchangeConfigRepository`. Stores per-agency
 * Sandata Provider ID and JSONB mappings for caregivers + services. The
 * `findValid()` overload returns the strongly-typed `SandataConfig` only when
 * the provider_id is populated; `findByAgency()` returns the partial row
 * (nullable identity) so the admin UI can render a half-filled state.
 */
import type { Knex } from 'knex';
import { type SandataCaregiverMapping, type SandataConfig, type SandataServiceMapping } from '../services/sandata-mapping.js';
import type { IntegrationCredentials } from '../integrations/types.js';
import type { SandataClientConfig } from '../integrations/sandata-client.js';
export interface PartialSandataConfig {
    agencyId: string;
    providerId: string | null;
    timezone: string;
    caregivers: SandataCaregiverMapping[];
    services: SandataServiceMapping[];
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
export interface SandataConfigUpsert {
    agencyId: string;
    providerId: string | null;
    timezone: string;
    caregivers: SandataCaregiverMapping[];
    services: SandataServiceMapping[];
    enabled: boolean;
    apiBaseUrl?: string | null;
    credentials?: IntegrationCredentials | null;
}
export declare class AgencySandataConfigRepository {
    private readonly db;
    constructor(db: Knex);
    findByAgency(agencyId: string): Promise<PartialSandataConfig | undefined>;
    findValid(agencyId: string): Promise<SandataConfig | undefined>;
    /**
     * Returns the full submission config WITH decrypted credentials — for the
     * Sandata client only. Never expose this to an API response; the admin UI
     * uses `findByAgency` (which carries `hasCredentials`, not the secret).
     */
    findSubmissionConfig(agencyId: string): Promise<SandataClientConfig | undefined>;
    upsert(input: SandataConfigUpsert): Promise<PartialSandataConfig>;
}
//# sourceMappingURL=agency-sandata-config-repository.d.ts.map