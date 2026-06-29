/**
 * Shared types for outbound EVV-aggregator and clearinghouse submission.
 *
 * Every transport returns a discriminated `SubmitResult` so callers can gate
 * honestly: `not_configured` means the agency has not finished integration
 * setup (no endpoint / no credentials / disabled) and must NEVER be conflated
 * with a real submission. A real call yields `ok` with per-item acknowledgments,
 * or `error` with the cause and whether a retry could succeed.
 */
/** One verified visit shaped for aggregator submission (Cures-Act data points). */
export interface VisitSubmission {
    visitId: string;
    /** Internal client id; the transport maps it to the aggregator's id. */
    clientId: string;
    /** Internal caregiver id; the transport maps it to the aggregator's worker id. */
    caregiverId: string;
    /** Internal service code; the transport maps it to the aggregator's code. */
    serviceCode: string;
    /** ISO-8601 UTC clock-in / clock-out timestamps. */
    clockInAt: string;
    clockOutAt: string | null;
    clockInLat: number | null;
    clockInLng: number | null;
    clockOutLat: number | null;
    clockOutLng: number | null;
    /** 'gps' | 'fvv' | 'telephony' | 'manual' */
    verificationMethod: string;
}
/** Per-visit acknowledgment returned by the aggregator. */
export interface VisitAck {
    visitId: string;
    status: 'submitted' | 'accepted' | 'rejected';
    confirmationId?: string;
    /** Present when the aggregator rejected this individual visit. */
    error?: string;
}
/**
 * Result of an aggregator batch submission.
 *  - `not_configured`: setup incomplete; nothing was sent.
 *  - `ok`: the batch reached the aggregator; `acks` carry per-visit status.
 *  - `error`: the call failed as a whole; `retryable` tells the caller whether
 *    a later retry (network blip, 5xx) is sane vs a permanent 4xx/auth failure.
 */
export type AggregatorSubmitResult = {
    kind: 'not_configured';
    reason: string;
} | {
    kind: 'ok';
    batchId: string;
    acks: VisitAck[];
} | {
    kind: 'error';
    message: string;
    retryable: boolean;
};
/**
 * Decrypted credential bag for a trading-partner integration. Sourced from the
 * AES-256-GCM `credentials_encrypted` column (see security/cell-cipher.ts) and
 * parsed from JSON. NEVER log this and NEVER return it to an API client.
 */
export interface IntegrationCredentials {
    username?: string;
    password?: string;
    apiKey?: string;
    /** Sandata account / agency account identifier. */
    account?: string;
    [key: string]: string | undefined;
}
//# sourceMappingURL=types.d.ts.map