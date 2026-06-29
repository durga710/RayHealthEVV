/**
 * HHAeXchange EVV submission client — SCAFFOLD.
 *
 * Mirrors the Sandata client's shape and gating so wiring it into the
 * `/exports/hhaexchange/submit` route is identical to Sandata. The HTTP payload
 * contract is intentionally left unimplemented: HHAeXchange's EDI/API submission
 * requires the agency's Tax ID + Provider ID and an HHAeXchange integration
 * account whose spec/sandbox is issued per-agency. `submitVisits` therefore
 * returns `not_configured` until setup is complete, and a clear, non-retryable
 * `error` once configured — never a fake success. Replace the marked block with
 * the real transport when the HHAeXchange spec + credentials are in hand.
 */
export async function submitVisits(config, _visits) {
    if (!config.enabled)
        return { kind: 'not_configured', reason: 'HHAeXchange integration is disabled for this agency' };
    if (!config.apiBaseUrl)
        return { kind: 'not_configured', reason: 'No HHAeXchange API base URL configured' };
    if (!config.agencyTaxId || !config.hhaProviderId) {
        return { kind: 'not_configured', reason: 'No HHAeXchange Tax ID / Provider ID configured' };
    }
    const creds = config.credentials;
    const hasAuth = Boolean(creds && (creds.apiKey || (creds.username && creds.password)));
    if (!hasAuth)
        return { kind: 'not_configured', reason: 'No HHAeXchange API credentials configured' };
    // ─── REAL TRANSPORT GOES HERE (align to HHAeXchange integration spec) ──────
    return {
        kind: 'error',
        message: 'HHAeXchange automated submission is not yet implemented; export the CSV and upload it to the HHAeXchange portal.',
        retryable: false,
    };
}
//# sourceMappingURL=hhaexchange-client.js.map