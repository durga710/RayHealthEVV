/**
 * Sandata Alternate-EVV REST transport.
 *
 * Thin wrapper over the shared `http` helpers implementing Sandata's async
 * contract: POST a batch of CLIENT/EMPLOYEE/VISIT records → receive a UUID,
 * then GET `/{entity}/status/{uuid}` to retrieve per-record ACCEPTED / REJECTED
 * / EXCEPTION results once Sandata has processed them.
 *
 * Authentication is HTTP Basic; multi-agency (MCO / vendor) transmissions add an
 * `EntityGuid` header. The client performs NO validation or persistence, it is
 * pure transport; the transmission service owns sequencing, state, and retries.
 */

import { basicAuth, getJson, postJson, type HttpJsonResponse } from '../http.js';
import {
  SandataEntityType,
  type SandataAltEvvConfig,
  type SandataClient,
  type SandataEmployee,
  type SandataPostResponse,
  type SandataStatusResponse,
  type SandataVisit,
} from './types.js';

/** Maps an entity type to its REST collection path segment. */
const ENTITY_PATH: Record<SandataEntityType, string> = {
  [SandataEntityType.CLIENT]: 'clients',
  [SandataEntityType.EMPLOYEE]: 'employees',
  [SandataEntityType.VISIT]: 'visits',
};

export type SandataEntityRecord = SandataClient | SandataEmployee | SandataVisit;

/** Outcome of a POST: either Sandata accepted the batch (uuid) or it failed. */
export type SandataPostOutcome =
  | { kind: 'accepted'; uuid: string; raw: SandataPostResponse }
  | { kind: 'error'; message: string; status: number; retryable: boolean };

/** Outcome of a status poll. `not_ready` means keep the transmission pending. */
export type SandataStatusOutcome =
  | { kind: 'ready'; response: SandataStatusResponse }
  | { kind: 'not_ready' }
  | { kind: 'error'; message: string; status: number; retryable: boolean };

export class SandataApiClient {
  constructor(private readonly config: SandataAltEvvConfig) {}

  private baseUrl(): string {
    return this.config.baseUrl.replace(/\/$/, '');
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      authorization: basicAuth(this.config.username, this.config.password),
    };
    if (this.config.entityGuid) headers.EntityGuid = this.config.entityGuid;
    return headers;
  }

  /** True for transient failures (5xx / network) where a retry is sane. */
  private isRetryable(status: number): boolean {
    return status === 0 || status >= 500;
  }

  /** POST a single-entity batch. Returns the Sandata UUID or a classified error. */
  async post(entity: SandataEntityType, batch: SandataEntityRecord[]): Promise<SandataPostOutcome> {
    const url = `${this.baseUrl()}/${ENTITY_PATH[entity]}`;
    let res: HttpJsonResponse;
    try {
      res = await postJson(url, batch, { headers: this.headers() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'network error';
      return { kind: 'error', message: `Sandata ${entity} POST failed: ${message}`, status: 0, retryable: true };
    }

    if (!res.ok) {
      const detail = res.text ? res.text.slice(0, 300) : `HTTP ${res.status}`;
      const retryable = res.status !== 401 && res.status !== 403 && this.isRetryable(res.status);
      return { kind: 'error', message: `Sandata rejected the ${entity} batch: ${detail}`, status: res.status, retryable };
    }

    const body = (res.body ?? {}) as SandataPostResponse;
    if (!body.uuid) {
      return { kind: 'error', message: 'Sandata returned no UUID for the batch', status: res.status, retryable: false };
    }
    return { kind: 'accepted', uuid: body.uuid, raw: body };
  }

  /** GET processing status for a previously-posted batch UUID. */
  async getStatus(entity: SandataEntityType, uuid: string): Promise<SandataStatusOutcome> {
    const url = `${this.baseUrl()}/${ENTITY_PATH[entity]}/status/${encodeURIComponent(uuid)}`;
    let res: HttpJsonResponse;
    try {
      res = await getJson(url, { headers: this.headers() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'network error';
      return { kind: 'error', message: `Sandata ${entity} status poll failed: ${message}`, status: 0, retryable: true };
    }

    // Sandata returns 404 (or a "not ready" message) while the batch is still
    // being processed, that is not an error, just keep polling.
    if (res.status === 404) return { kind: 'not_ready' };
    if (!res.ok) {
      const detail = res.text ? res.text.slice(0, 300) : `HTTP ${res.status}`;
      return { kind: 'error', message: `Sandata status poll error: ${detail}`, status: res.status, retryable: this.isRetryable(res.status) };
    }

    const body = (res.body ?? {}) as SandataStatusResponse;
    const stillProcessing =
      body.status === 'IN_PROGRESS' || /not ready/i.test(body.message ?? '');
    if (stillProcessing) return { kind: 'not_ready' };

    return { kind: 'ready', response: body };
  }
}
