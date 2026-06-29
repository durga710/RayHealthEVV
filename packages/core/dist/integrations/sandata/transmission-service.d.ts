/**
 * Sandata Alt EVV transmission orchestrator.
 *
 * Ties the pieces together for the async POST→UUID→poll lifecycle:
 *   validate → assign next SequenceID → map to wire → POST batch → persist state.
 *
 * Sandata enforces a load-order dependency: a VISIT is only accepted once its
 * CLIENT and EMPLOYEE are VERIFIED. Because verification is itself async (via a
 * status poll), `transmitVisits` DEFERS any visit whose dependencies are not yet
 * verified rather than sending a doomed batch. The caller transmits clients +
 * employees, polls until they verify, then transmits visits.
 *
 * Pure orchestration over the `SandataStateRepo` interface + `SandataApiClient`
 * — no direct DB or HTTP — so it is fully unit-testable with in-memory fakes.
 */
import type { Client } from '../../domain/client.js';
import type { Caregiver } from '../../domain/caregiver.js';
import type { EvvVisit } from '../../domain/evv.js';
import type { SandataApiClient } from './api-client.js';
import { type MapVisitOptions } from './mapper.js';
import type { SandataStateRepo } from './state-repository.js';
import { SandataEntityType } from './types.js';
import { type SandataValidationContext, type ValidationIssue } from './validator.js';
export interface BlockedRecord {
    externalId: string;
    issues: ValidationIssue[];
}
export interface DeferredRecord {
    externalId: string;
    reason: string;
}
export interface TransmitResult {
    entityType: SandataEntityType;
    /** Number of records actually POSTed in the batch. */
    posted: number;
    /** Sandata batch UUID when a batch was sent, else null. */
    uuid: string | null;
    /** Records that failed HARD_BLOCK validation and were not sent. */
    blocked: BlockedRecord[];
    /** Visits whose client/employee are not yet VERIFIED (not sent this round). */
    deferred: DeferredRecord[];
    /** Set when the transport call failed wholesale. */
    error: {
        message: string;
        retryable: boolean;
    } | null;
}
export interface PollResult {
    /** Pending transmissions inspected this run. */
    polled: number;
    /** Transmissions whose results came back and were applied. */
    completed: number;
    /** Transmissions Sandata had not finished processing yet. */
    notReady: number;
    verified: number;
    rejected: number;
    exceptions: number;
    errors: string[];
}
export declare class SandataTransmissionService {
    private readonly api;
    private readonly state;
    private readonly environment;
    constructor(api: SandataApiClient, state: SandataStateRepo, environment: string);
    private postBatch;
    transmitClients(agencyId: string, clients: Client[], ctx?: SandataValidationContext): Promise<TransmitResult>;
    transmitEmployees(agencyId: string, caregivers: Caregiver[]): Promise<TransmitResult>;
    transmitVisits(agencyId: string, visits: EvvVisit[], ctx?: SandataValidationContext, mapOpts?: MapVisitOptions): Promise<TransmitResult>;
    pollPendingStatuses(agencyId: string): Promise<PollResult>;
}
//# sourceMappingURL=transmission-service.d.ts.map