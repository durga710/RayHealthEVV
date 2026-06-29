/**
 * Outbound trading-partner integrations (EVV aggregators + claim clearinghouse).
 *
 * The three clients each export a `submitVisits` / `submitClaim`, so they are
 * re-exported as namespaces to avoid collisions: `SandataClient.submitVisits`,
 * `HhaexchangeClient.submitVisits`, `ClearinghouseClient.submitClaim`.
 */
export * from './types.js';
export * as SandataClient from './sandata-client.js';
export * as HhaexchangeClient from './hhaexchange-client.js';
export * as ClearinghouseClient from './clearinghouse-client.js';
//# sourceMappingURL=index.d.ts.map