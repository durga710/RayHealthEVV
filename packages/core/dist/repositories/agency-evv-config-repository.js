/**
 * Repository for the `agency_evv_config` table.
 *
 * Single row per agency. `findOrInitialize` is the typical entry point —
 * returns a stored row if one exists, otherwise synthesizes a default that
 * matches the state registry's defaults (without persisting). Callers that
 * want to persist must call `upsert`.
 */
import { resolveAggregator, getStateConfig } from '../config/states/index.js';
function rowToConfig(row) {
    return {
        agencyId: row.agency_id,
        aggregator: row.aggregator ?? 'none',
        stateCode: row.state_code.toUpperCase(),
        productionReady: Boolean(row.production_ready),
    };
}
export class AgencyEvvConfigRepository {
    constructor(db) {
        this.db = db;
    }
    async findByAgency(agencyId) {
        const row = (await this.db('agency_evv_config').where({ agency_id: agencyId }).first());
        return row ? rowToConfig(row) : undefined;
    }
    /**
     * Look up the config, or compute a sensible default from the agency's
     * state. Does NOT persist — the caller decides whether to write back.
     */
    async findOrInitialize(agencyId, stateCode) {
        const existing = await this.findByAgency(agencyId);
        if (existing)
            return existing;
        const normalizedState = stateCode.toUpperCase();
        const stateConfig = getStateConfig(normalizedState);
        return {
            agencyId,
            aggregator: stateConfig?.defaultAggregator ?? 'none',
            stateCode: normalizedState,
            productionReady: false,
        };
    }
    async upsert(input) {
        const payload = {
            agency_id: input.agencyId,
            aggregator: input.aggregator,
            state_code: input.stateCode.toUpperCase(),
            production_ready: input.productionReady,
            updated_at: this.db.fn.now(),
        };
        await this.db('agency_evv_config')
            .insert({ ...payload, created_at: this.db.fn.now() })
            .onConflict('agency_id')
            .merge({
            aggregator: payload.aggregator,
            state_code: payload.state_code,
            production_ready: payload.production_ready,
            updated_at: payload.updated_at,
        });
        const stored = await this.findByAgency(input.agencyId);
        if (!stored)
            throw new Error(`upsert succeeded but no row found for agency=${input.agencyId}`);
        return stored;
    }
    /**
     * Resolves the effective aggregator for an agency, respecting the state's
     * `aggregatorChoice` flag. States that don't allow choice (e.g. NJ) ignore
     * the persisted preference and always return the state default.
     */
    async resolve(agencyId, stateCode) {
        const config = await this.findByAgency(agencyId);
        return resolveAggregator(stateCode, config?.aggregator === 'none' ? undefined : config?.aggregator);
    }
}
//# sourceMappingURL=agency-evv-config-repository.js.map