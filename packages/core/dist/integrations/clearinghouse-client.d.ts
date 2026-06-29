/**
 * Claim clearinghouse client — SCAFFOLD (837 submit / 835 retrieve).
 *
 * The 837P generator and 835 parser/poster already exist in core; this is the
 * missing transport that would actually move an EDI file to a clearinghouse and
 * pull remittances back. Real transmission is per-agency: an SFTP drop or a
 * clearinghouse REST API, each needing a trading-partner account + submitter/
 * receiver IDs. Until that config is present, `submitClaim` / `fetchRemittances`
 * return `not_configured`; once configured they return a clear, non-retryable
 * `error` (transport not built) rather than faking a transmission. Replace the
 * marked blocks with the real SFTP/HTTP transport when credentials are in hand.
 */
export interface ClearinghouseClientConfig {
    enabled: boolean;
    /** 'sftp' | 'http' */
    transport: string;
    /** SFTP host or HTTPS base URL. */
    endpoint: string | null;
    /** Decrypted credentials (username/password or apiKey/private key ref). */
    credentials: Record<string, string | undefined> | null;
    /** submitterId, receiverId, inbound/outbound directories, etc. */
    settings: Record<string, unknown>;
}
export type ClearinghouseResult = {
    kind: 'not_configured';
    reason: string;
} | {
    kind: 'ok';
    reference: string;
} | {
    kind: 'error';
    message: string;
    retryable: boolean;
};
/** Transmit one 837P EDI document to the clearinghouse. */
export declare function submitClaim(config: ClearinghouseClientConfig, _edi837: string): Promise<ClearinghouseResult>;
/** Retrieve pending 835 remittance files from the clearinghouse. */
export declare function fetchRemittances(config: ClearinghouseClientConfig): Promise<{
    kind: 'not_configured';
    reason: string;
} | {
    kind: 'ok';
    files: string[];
} | {
    kind: 'error';
    message: string;
    retryable: boolean;
}>;
//# sourceMappingURL=clearinghouse-client.d.ts.map