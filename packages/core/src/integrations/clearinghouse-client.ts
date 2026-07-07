/**
 * Claim clearinghouse client. SCAFFOLD (837 submit / 835 retrieve).
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

export type ClearinghouseResult =
  | { kind: 'not_configured'; reason: string }
  | { kind: 'ok'; reference: string }
  | { kind: 'error'; message: string; retryable: boolean };

function gate(config: ClearinghouseClientConfig): { kind: 'not_configured'; reason: string } | null {
  if (!config.enabled) return { kind: 'not_configured', reason: 'Clearinghouse integration is disabled for this agency' };
  if (!config.endpoint) return { kind: 'not_configured', reason: 'No clearinghouse endpoint configured' };
  const creds = config.credentials;
  const hasAuth = Boolean(creds && (creds.apiKey || (creds.username && creds.password)));
  if (!hasAuth) return { kind: 'not_configured', reason: 'No clearinghouse credentials configured' };
  return null;
}

/** Transmit one 837P EDI document to the clearinghouse. */
export async function submitClaim(
  config: ClearinghouseClientConfig,
  _edi837: string,
): Promise<ClearinghouseResult> {
  const blocked = gate(config);
  if (blocked) return blocked;
  // ─── REAL SFTP/HTTP TRANSMISSION GOES HERE ─────────────────────────────────
  return {
    kind: 'error',
    message: 'Automated 837 transmission is not yet implemented; download the 837 file and upload it to your clearinghouse portal.',
    retryable: false,
  };
}

/** Retrieve pending 835 remittance files from the clearinghouse. */
export async function fetchRemittances(
  config: ClearinghouseClientConfig,
): Promise<
  | { kind: 'not_configured'; reason: string }
  | { kind: 'ok'; files: string[] }
  | { kind: 'error'; message: string; retryable: boolean }
> {
  const blocked = gate(config);
  if (blocked) return blocked;
  // ─── REAL SFTP/HTTP RETRIEVAL GOES HERE ────────────────────────────────────
  return {
    kind: 'error',
    message: 'Automated 835 retrieval is not yet implemented; download the 835 file from your clearinghouse and post it via /api/billing/remittances/post.',
    retryable: false,
  };
}
