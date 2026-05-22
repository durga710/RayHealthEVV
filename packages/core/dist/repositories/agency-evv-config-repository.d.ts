/**
 * Repository for the `agency_evv_config` table.
 *
 * Single row per agency. `findOrInitialize` is the typical entry point —
 * returns a stored row if one exists, otherwise synthesizes a default that
 * matches the state registry's defaults (without persisting). Callers that
 * want to persist must call `upsert`.
 */
import type { Knex } from 'knex';
import type { AgencyEvvConfig, EvvAggregatorValue } from '../domain/agency-evv-config.js';
export declare class AgencyEvvConfigRepository {
    private readonly db;
    constructor(db: Knex);
    findByAgency(agencyId: string): Promise<AgencyEvvConfig | undefined>;
    /**
     * Look up the config, or compute a sensible default from the agency's
     * state. Does NOT persist — the caller decides whether to write back.
     */
    findOrInitialize(agencyId: string, stateCode: string): Promise<AgencyEvvConfig>;
    upsert(input: AgencyEvvConfig): Promise<AgencyEvvConfig>;
    /**
     * Resolves the effective aggregator for an agency, respecting the state's
     * `aggregatorChoice` flag. States that don't allow choice (e.g. NJ) ignore
     * the persisted preference and always return the state default.
     */
    resolve(agencyId: string, stateCode: string): Promise<EvvAggregatorValue>;
}
//# sourceMappingURL=agency-evv-config-repository.d.ts.map