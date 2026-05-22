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
export interface PartialSandataConfig {
    agencyId: string;
    providerId: string | null;
    timezone: string;
    caregivers: SandataCaregiverMapping[];
    services: SandataServiceMapping[];
    enabled: boolean;
}
export declare class AgencySandataConfigRepository {
    private readonly db;
    constructor(db: Knex);
    findByAgency(agencyId: string): Promise<PartialSandataConfig | undefined>;
    findValid(agencyId: string): Promise<SandataConfig | undefined>;
    upsert(input: PartialSandataConfig): Promise<PartialSandataConfig>;
}
//# sourceMappingURL=agency-sandata-config-repository.d.ts.map