/**
 * Durable state for the Sandata Alt EVV async lifecycle.
 *
 * The synchronous client had no memory; the async POST→UUID→poll model needs
 * persistent state the transmission service drives:
 *  - sandata_record_state: per CLIENT/EMPLOYEE/VISIT record, its monotonically
 *    increasing SequenceID (Sandata requires it grow on every resend), current
 *    status, and the last UUID/poll result.
 *  - sandata_transmission: one row per POSTed batch UUID (the poll ledger).
 *  - sandata_transmission_record: which records rode in which transmission.
 *  - sandata_exception_queue: visit exceptions surfaced back to staff.
 *
 * The `SandataStateRepo` interface lets the transmission service be unit-tested
 * with an in-memory fake; `KnexSandataStateRepository` is the production impl.
 */

import type { Knex } from 'knex';
import { SandataEntityType, SandataRecordStatus } from './types.js';

/** A record that has just been POSTed, with the SequenceID it was stamped with. */
export interface PostedRecord {
  externalId: string;
  sequenceId: number;
  /** sha256 of the transmitted payload (idempotency / change detection). */
  payloadHash?: string;
}

/** A pending (not-yet-completed) transmission awaiting a status poll. */
export interface PendingTransmission {
  id: number;
  agencyId: string;
  entityType: SandataEntityType;
  uuid: string;
  recordCount: number;
  pollAttempts: number;
}

/** Per-record result parsed from a Sandata status response. */
export interface RecordStatusUpdate {
  externalId: string;
  status: SandataRecordStatus; // VERIFIED | EXCEPTION | REJECTED
  reasonCodes?: string[];
  description?: string;
}

export interface ExceptionInput {
  visitId?: string | null;
  externalId: string;
  exceptionId?: string | null;
  reasonCodes?: string[];
  description?: string | null;
}

export interface SandataStateRepo {
  /** SequenceID to stamp on the NEXT transmission of this record (1, then prior+1). */
  nextSequence(agencyId: string, entityType: SandataEntityType, externalId: string): Promise<number>;
  /** Persist a posted batch: create the transmission row + upsert each record to RECEIVED. */
  recordTransmitted(
    agencyId: string,
    entityType: SandataEntityType,
    uuid: string,
    environment: string,
    records: PostedRecord[],
  ): Promise<number>;
  /** Transmissions still in RECEIVED status (awaiting a status poll). */
  findPendingTransmissions(agencyId: string): Promise<PendingTransmission[]>;
  /** Apply per-record results and mark the transmission COMPLETED. */
  applyStatusResults(transmissionId: number, results: RecordStatusUpdate[]): Promise<void>;
  /** Bump poll bookkeeping when Sandata says "not ready yet". */
  markTransmissionPolled(transmissionId: number): Promise<void>;
  /** True only when BOTH referenced records are VERIFIED (visit load-order gate). */
  areDependenciesVerified(agencyId: string, clientExternalId: string, employeeExternalId: string): Promise<boolean>;
  /** Queue a visit exception for staff resolution. */
  enqueueException(agencyId: string, input: ExceptionInput): Promise<void>;
}

interface RecordStateRow {
  id: number;
  agency_id: string;
  entity_type: string;
  external_id: string;
  sequence_id: number;
  status: string;
}

interface TransmissionRow {
  id: number;
  agency_id: string;
  entity_type: string;
  uuid: string;
  record_count: number;
  poll_attempts: number;
}

export class KnexSandataStateRepository implements SandataStateRepo {
  constructor(private readonly db: Knex) {}

  async nextSequence(agencyId: string, entityType: SandataEntityType, externalId: string): Promise<number> {
    const row = (await this.db('sandata_record_state')
      .where({ agency_id: agencyId, entity_type: entityType, external_id: externalId })
      .first('sequence_id')) as Pick<RecordStateRow, 'sequence_id'> | undefined;
    return row ? row.sequence_id + 1 : 1;
  }

  async recordTransmitted(
    agencyId: string,
    entityType: SandataEntityType,
    uuid: string,
    environment: string,
    records: PostedRecord[],
  ): Promise<number> {
    return this.db.transaction(async (trx) => {
      const [tx] = (await trx('sandata_transmission')
        .insert({
          agency_id: agencyId,
          entity_type: entityType,
          uuid,
          record_count: records.length,
          environment,
          status: 'RECEIVED',
          posted_at: trx.fn.now(),
        })
        .returning('id')) as Array<{ id: number }>;
      const transmissionId = tx.id;

      for (const rec of records) {
        const statePayload = {
          agency_id: agencyId,
          entity_type: entityType,
          external_id: rec.externalId,
          sequence_id: rec.sequenceId,
          status: SandataRecordStatus.RECEIVED,
          last_uuid: uuid,
          last_transmitted_at: trx.fn.now(),
          last_payload_hash: rec.payloadHash ?? null,
          updated_at: trx.fn.now(),
        };
        await trx('sandata_record_state')
          .insert({ ...statePayload, created_at: trx.fn.now() })
          .onConflict(['agency_id', 'entity_type', 'external_id'])
          .merge(statePayload);

        const stateRow = (await trx('sandata_record_state')
          .where({ agency_id: agencyId, entity_type: entityType, external_id: rec.externalId })
          .first('id')) as Pick<RecordStateRow, 'id'> | undefined;
        if (stateRow) {
          await trx('sandata_transmission_record')
            .insert({ transmission_id: transmissionId, record_state_id: stateRow.id, external_id: rec.externalId })
            .onConflict(['transmission_id', 'record_state_id'])
            .ignore();
        }
      }

      return transmissionId;
    });
  }

  async findPendingTransmissions(agencyId: string): Promise<PendingTransmission[]> {
    const rows = (await this.db('sandata_transmission')
      .where({ agency_id: agencyId, status: 'RECEIVED' })
      .orderBy('posted_at', 'asc')) as TransmissionRow[];
    return rows.map((r) => ({
      id: r.id,
      agencyId: r.agency_id,
      entityType: r.entity_type as SandataEntityType,
      uuid: r.uuid,
      recordCount: r.record_count,
      pollAttempts: r.poll_attempts,
    }));
  }

  async applyStatusResults(transmissionId: number, results: RecordStatusUpdate[]): Promise<void> {
    await this.db.transaction(async (trx) => {
      const tx = (await trx('sandata_transmission').where({ id: transmissionId }).first()) as
        | (TransmissionRow & { entity_type: string })
        | undefined;
      if (!tx) return;

      for (const result of results) {
        await trx('sandata_record_state')
          .where({ agency_id: tx.agency_id, entity_type: tx.entity_type, external_id: result.externalId })
          .update({
            status: result.status,
            last_reason_codes: result.reasonCodes ?? null,
            last_description: result.description ?? null,
            last_status_checked_at: trx.fn.now(),
            updated_at: trx.fn.now(),
          });
      }

      await trx('sandata_transmission').where({ id: transmissionId }).update({
        status: 'COMPLETED',
        status_polled_at: trx.fn.now(),
        completed_at: trx.fn.now(),
        poll_attempts: tx.poll_attempts + 1,
      });
    });
  }

  async markTransmissionPolled(transmissionId: number): Promise<void> {
    await this.db('sandata_transmission')
      .where({ id: transmissionId })
      .update({ status_polled_at: this.db.fn.now(), poll_attempts: this.db.raw('poll_attempts + 1') });
  }

  async areDependenciesVerified(
    agencyId: string,
    clientExternalId: string,
    employeeExternalId: string,
  ): Promise<boolean> {
    const rows = (await this.db('sandata_record_state')
      .where({ agency_id: agencyId })
      .andWhere((qb) => {
        qb.where({ entity_type: SandataEntityType.CLIENT, external_id: clientExternalId }).orWhere({
          entity_type: SandataEntityType.EMPLOYEE,
          external_id: employeeExternalId,
        });
      })
      .select('entity_type', 'status')) as Array<Pick<RecordStateRow, 'entity_type' | 'status'>>;

    const clientOk = rows.some(
      (r) => r.entity_type === SandataEntityType.CLIENT && r.status === SandataRecordStatus.VERIFIED,
    );
    const employeeOk = rows.some(
      (r) => r.entity_type === SandataEntityType.EMPLOYEE && r.status === SandataRecordStatus.VERIFIED,
    );
    return clientOk && employeeOk;
  }

  async enqueueException(agencyId: string, input: ExceptionInput): Promise<void> {
    await this.db('sandata_exception_queue').insert({
      agency_id: agencyId,
      visit_id: input.visitId ?? null,
      external_id: input.externalId,
      exception_id: input.exceptionId ?? null,
      reason_codes: input.reasonCodes ?? null,
      description: input.description ?? null,
      requires_fix: true,
      resolved: false,
      created_at: this.db.fn.now(),
      updated_at: this.db.fn.now(),
    });
  }
}
