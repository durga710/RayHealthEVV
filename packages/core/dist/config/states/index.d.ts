/**
 * State registry — single source of truth for per-state operational config.
 *
 * Lookup: `getStateConfig('PA')` returns the StateConfig.
 * Add a state: create a new file in this folder, export from here.
 *
 * Backward compatibility: the existing `pennsylvania.ts` constants are
 * re-exported from packages/core/src/config/pennsylvania.ts for code that
 * still imports them directly. New code should use the registry.
 */
import { PENNSYLVANIA } from './pennsylvania.js';
import { NEW_JERSEY } from './new-jersey.js';
import type { StateConfig } from './types.js';
export type * from './types.js';
export { PENNSYLVANIA, NEW_JERSEY };
/**
 * Look up a state config by 2-letter code. Returns `undefined` for unknown
 * states — callers should error explicitly rather than silently falling back.
 */
export declare function getStateConfig(code: string): StateConfig | undefined;
/** All registered states, sorted alphabetically by code. */
export declare function allStates(): StateConfig[];
/** Production-ready states (excludes any with productionReady=false). */
export declare function productionStates(): StateConfig[];
/**
 * Resolve the EVV aggregator for an agency, given the state and the agency's
 * stored choice. States without choice (e.g. NJ) ignore the agency's
 * preference and return the state default.
 */
export declare function resolveAggregator(stateCode: string, agencyPreference: 'sandata' | 'hhaexchange' | undefined): 'sandata' | 'hhaexchange' | 'none';
//# sourceMappingURL=index.d.ts.map