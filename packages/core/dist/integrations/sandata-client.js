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
import { basicAuth, postJson } from './http.js';
import { assertSafeOutboundUrl } from './url-guard.js';
/** Maps internal visits to the Sandata API shape, skipping unmapped ones. */
export function buildSandataApiPayload(config, visits) {
    const workerByCaregiver = new Map(config.caregivers.map((c) => [c.caregiverId, c.externalWorkerId]));
    const hcpcsByService = new Map(config.services.map((s) => [s.internalServiceCode, { code: s.hcpcsCode, modifier: s.hcpcsModifier }]));
    const payloadVisits = [];
    const skipped = [];
    for (const v of visits) {
        const worker = workerByCaregiver.get(v.caregiverId);
        const service = hcpcsByService.get(v.serviceCode);
        if (!worker) {
            skipped.push({ visitId: v.visitId, status: 'rejected', error: 'No Sandata worker mapping for caregiver' });
            continue;
        }
        if (!service) {
            skipped.push({ visitId: v.visitId, status: 'rejected', error: `No HCPCS mapping for service code ${v.serviceCode}` });
            continue;
        }
        payloadVisits.push({
            visitOtherId: v.visitId,
            clientOtherId: v.clientId,
            employeeOtherId: worker,
            serviceCode: service.code,
            serviceModifier: service.modifier,
            callInTime: v.clockInAt,
            callOutTime: v.clockOutAt,
            callInLatitude: v.clockInLat,
            callInLongitude: v.clockInLng,
            callOutLatitude: v.clockOutLat,
            callOutLongitude: v.clockOutLng,
            evvType: v.verificationMethod,
        });
    }
    return { payload: { providerId: config.providerId ?? '', visits: payloadVisits }, skipped };
}
function gateConfig(config) {
    if (!config.enabled)
        return { kind: 'not_configured', reason: 'Sandata integration is disabled for this agency' };
    if (!config.apiBaseUrl)
        return { kind: 'not_configured', reason: 'No Sandata API base URL configured' };
    if (!config.providerId)
        return { kind: 'not_configured', reason: 'No Sandata Provider ID configured' };
    const creds = config.credentials;
    const hasAuth = Boolean(creds && (creds.apiKey || (creds.username && creds.password)));
    if (!hasAuth)
        return { kind: 'not_configured', reason: 'No Sandata API credentials configured' };
    return null;
}
function authHeaders(creds) {
    if (creds.apiKey)
        return { authorization: `Bearer ${creds.apiKey}` };
    return { authorization: basicAuth(creds.username ?? '', creds.password ?? '') };
}
function normalizeStatus(raw) {
    const s = (raw ?? '').toLowerCase();
    if (s === 'accepted' || s === 'success' || s === 'complete')
        return 'accepted';
    if (s === 'rejected' || s === 'error' || s === 'failed')
        return 'rejected';
    return 'submitted';
}
/**
 * Submit a batch of verified visits to Sandata. Returns `not_configured` when
 * setup is incomplete (nothing sent), `ok` with per-visit acks when the batch
 * reached Sandata, or `error` (with `retryable`) when the call failed wholesale.
 */
export async function submitVisits(config, visits) {
    const gate = gateConfig(config);
    if (gate)
        return gate;
    // Safe: gateConfig guarantees these are present.
    const creds = config.credentials;
    const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
    const { payload, skipped } = buildSandataApiPayload(config, visits);
    if (payload.visits.length === 0) {
        // Nothing mappable to send; surface the skips as the (empty) batch result.
        return { kind: 'ok', batchId: 'noop-empty', acks: skipped };
    }
    // Defense-in-depth against SSRF: refuse to call a non-https or
    // private/internal URL even if one was somehow stored. The config route
    // validates this on write; this guards stored/legacy values too.
    try {
        assertSafeOutboundUrl(`${baseUrl}/visits`);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'unsafe URL';
        return { kind: 'error', message: `Sandata request blocked: ${message}`, retryable: false };
    }
    let res;
    try {
        res = await postJson(`${baseUrl}/visits`, payload, { headers: authHeaders(creds) });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'network error';
        return { kind: 'error', message: `Sandata request failed: ${message}`, retryable: true };
    }
    if (!res.ok) {
        const retryable = res.status >= 500;
        // Do NOT reflect the raw upstream response body back to the caller — with a
        // caller-influenced base URL that would be a reflected-SSRF read primitive.
        // Report only the status code; the full body is available server-side.
        if (res.status === 401 || res.status === 403) {
            return { kind: 'error', message: `Sandata authentication failed (HTTP ${res.status})`, retryable: false };
        }
        return { kind: 'error', message: `Sandata rejected the batch (HTTP ${res.status})`, retryable };
    }
    const data = (res.body ?? {});
    const batchId = data.batchId ?? `sandata-${payload.providerId}-${payload.visits.length}`;
    const ackById = new Map((data.results ?? []).map((r) => [
        r.visitOtherId ?? '',
        { status: normalizeStatus(r.status), confirmationId: r.confirmationId, error: r.error },
    ]));
    const acks = payload.visits.map((v) => {
        const ack = ackById.get(v.visitOtherId);
        return {
            visitId: v.visitOtherId,
            status: ack?.status ?? 'submitted',
            confirmationId: ack?.confirmationId,
            error: ack?.error,
        };
    });
    return { kind: 'ok', batchId, acks: [...acks, ...skipped] };
}
//# sourceMappingURL=sandata-client.js.map