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
import type {
  AggregatorSubmitResult,
  IntegrationCredentials,
  VisitAck,
  VisitSubmission,
} from './types.js';
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
export function buildSandataApiPayload(
  config: SandataClientConfig,
  visits: VisitSubmission[],
): { payload: SandataApiPayload; skipped: VisitAck[] } {
  const workerByCaregiver = new Map(config.caregivers.map((c) => [c.caregiverId, c.externalWorkerId]));
  const hcpcsByService = new Map(
    config.services.map((s) => [s.internalServiceCode, { code: s.hcpcsCode, modifier: s.hcpcsModifier }]),
  );

  const payloadVisits: SandataVisitPayload[] = [];
  const skipped: VisitAck[] = [];

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

function gateConfig(config: SandataClientConfig): { kind: 'not_configured'; reason: string } | null {
  if (!config.enabled) return { kind: 'not_configured', reason: 'Sandata integration is disabled for this agency' };
  if (!config.apiBaseUrl) return { kind: 'not_configured', reason: 'No Sandata API base URL configured' };
  if (!config.providerId) return { kind: 'not_configured', reason: 'No Sandata Provider ID configured' };
  const creds = config.credentials;
  const hasAuth = Boolean(creds && (creds.apiKey || (creds.username && creds.password)));
  if (!hasAuth) return { kind: 'not_configured', reason: 'No Sandata API credentials configured' };
  return null;
}

function authHeaders(creds: IntegrationCredentials): Record<string, string> {
  if (creds.apiKey) return { authorization: `Bearer ${creds.apiKey}` };
  return { authorization: basicAuth(creds.username ?? '', creds.password ?? '') };
}

interface SandataApiResult {
  batchId?: string;
  results?: Array<{ visitOtherId?: string; status?: string; confirmationId?: string; error?: string }>;
}

function normalizeStatus(raw: string | undefined): VisitAck['status'] {
  const s = (raw ?? '').toLowerCase();
  if (s === 'accepted' || s === 'success' || s === 'complete') return 'accepted';
  if (s === 'rejected' || s === 'error' || s === 'failed') return 'rejected';
  return 'submitted';
}

/**
 * Submit a batch of verified visits to Sandata. Returns `not_configured` when
 * setup is incomplete (nothing sent), `ok` with per-visit acks when the batch
 * reached Sandata, or `error` (with `retryable`) when the call failed wholesale.
 */
export async function submitVisits(
  config: SandataClientConfig,
  visits: VisitSubmission[],
): Promise<AggregatorSubmitResult> {
  const gate = gateConfig(config);
  if (gate) return gate;
  // Safe: gateConfig guarantees these are present.
  const creds = config.credentials as IntegrationCredentials;
  const baseUrl = (config.apiBaseUrl as string).replace(/\/$/, '');

  const { payload, skipped } = buildSandataApiPayload(config, visits);
  if (payload.visits.length === 0) {
    // Nothing mappable to send; surface the skips as the (empty) batch result.
    return { kind: 'ok', batchId: 'noop-empty', acks: skipped };
  }

  let res;
  try {
    res = await postJson(`${baseUrl}/visits`, payload, { headers: authHeaders(creds) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'network error';
    return { kind: 'error', message: `Sandata request failed: ${message}`, retryable: true };
  }

  if (!res.ok) {
    const retryable = res.status >= 500;
    const detail = typeof res.text === 'string' && res.text ? res.text.slice(0, 300) : `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) {
      return { kind: 'error', message: `Sandata authentication failed (HTTP ${res.status})`, retryable: false };
    }
    return { kind: 'error', message: `Sandata rejected the batch: ${detail}`, retryable };
  }

  const data = (res.body ?? {}) as SandataApiResult;
  const batchId = data.batchId ?? `sandata-${payload.providerId}-${payload.visits.length}`;
  const ackById = new Map(
    (data.results ?? []).map((r) => [
      r.visitOtherId ?? '',
      { status: normalizeStatus(r.status), confirmationId: r.confirmationId, error: r.error },
    ]),
  );

  const acks: VisitAck[] = payload.visits.map((v) => {
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
