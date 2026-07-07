/**
 * Outbound trading-partner integrations (EVV aggregators + claim clearinghouse).
 *
 * The three clients each export a `submitVisits` / `submitClaim`, so they are
 * re-exported as namespaces to avoid collisions: `SandataClient.submitVisits`,
 * `HhaexchangeClient.submitVisits`, `ClearinghouseClient.submitClaim`.
 */
export * from './types.js';
export * from './url-guard.js';
export * as SandataClient from './sandata-client.js';
export * as HhaexchangeClient from './hhaexchange-client.js';
export * as ClearinghouseClient from './clearinghouse-client.js';

/**
 * Real Sandata Alternate-EVV (async POST → UUID → poll). Phase 1 = types +
 * mapper + validator; the synchronous `SandataClient` above is retired once the
 * transmission service lands.
 */
export * as SandataAltEvv from './sandata/index.js';
