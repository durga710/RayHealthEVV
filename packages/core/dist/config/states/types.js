/**
 * State-strategy types — shared shape for every state's operational config.
 *
 * Each U.S. state has its own EVV aggregator, credentialing rules, geofence
 * tolerance, and operating-track vocabulary. Rather than scattering
 * `if (state === 'PA')` across the codebase, we model every state as a row
 * in a registry. Adding a state is a registry entry, not a refactor.
 */
export {};
//# sourceMappingURL=types.js.map