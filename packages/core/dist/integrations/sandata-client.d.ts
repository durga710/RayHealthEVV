/**
 * Sandata Alternate-EVV submission client.
 *
 * Submits verified visits to a state's Sandata aggregator over its JSON HTTP
 * API and maps the response back onto per-visit acknowledgments. The endpoint
 * URL, Provider ID, and credentials are per-agency config (set during onboarding)
 * so a single deploy serves many agencies on distinct Sandata instances.
 *
 * IMPORTANT — payload contract: the exact field names below follow Sandata's
 * "Alternate Data Collection" / Open-Model interface, but each state's Sandata
 * instance (PA DHS included) issues its own integration spec + sandbox. Treat
 * `buildSandataApiPayload` as the single place to align field names/value
 * formats against that spec; the transport, gating, and response handling around
 * it do not change. Until an agency has a verified endpoint + credentials,
 * `submitVisits` returns `not_configured` and sends nothing.
 */
import type { AggregatorSubmitResult, IntegrationCredentials, VisitAck, VisitSubmission } from './types.js';
import type { SandataCaregiverMapping, SandataServiceMapping } from '../services/sandata-mapping.js';
export interface SandataClientConfig {
    /** Operator flips this true once Provider ID, mappings, and BAA are in place. */
    enabled: boolean;
    /** e.g. https://uat-api.sandata.com/interface/v3 — per state, per environment. */
    apiBaseUrl: string | null;
    /** 9-digit Sandata Provider ID assigned to the agency. */
    providerId: string | null;
    /** Decrypted API credentials (account + username/password or apiKey). */
    credentials: IntegrationCredentials | null;
    caregivers: SandataCaregiverMapping[];
    services: SandataServiceMapping[];
}
interface SandataVisitPayload {
    visitOtherId: string;
    clientOtherId: string;
    employeeOtherId: string;
    serviceCode: string;
    serviceModifier: string;
    callInTime: string;
    callOutTime: string | null;
    callInLatitude: number | null;
    callInLongitude: number | null;
    callOutLatitude: number | null;
    callOutLongitude: number | null;
    evvType: string;
}
export interface SandataApiPayload {
    providerId: string;
    visits: SandataVisitPayload[];
}
/** Maps internal visits to the Sandata API shape, skipping unmapped ones. */
export declare function buildSandataApiPayload(config: SandataClientConfig, visits: VisitSubmission[]): {
    payload: SandataApiPayload;
    skipped: VisitAck[];
};
/**
 * Submit a batch of verified visits to Sandata. Returns `not_configured` when
 * setup is incomplete (nothing sent), `ok` with per-visit acks when the batch
 * reached Sandata, or `error` (with `retryable`) when the call failed wholesale.
 */
export declare function submitVisits(config: SandataClientConfig, visits: VisitSubmission[]): Promise<AggregatorSubmitResult>;
export {};
//# sourceMappingURL=sandata-client.d.ts.map