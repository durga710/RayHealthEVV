/**
 * EVV aggregator submission for the app layer.
 *
 * Two responsibilities:
 *   - submitAgencyVisits: transmit a set of verified visits to one agency's
 *     Sandata or HHAeXchange connection and record the per-visit
 *     acknowledgments. This is the single submit path shared by the manual
 *     "Submit now" routes and the unattended sweep, so an operator-triggered
 *     batch and a nightly batch cannot drift apart.
 *   - runAggregatorSubmissionSweep: walk every agency whose aggregator setup
 *     is complete, submit whatever still owes a transmission, and summarize.
 *
 * Why the sweep selects by outstanding state rather than by date range: a
 * visit can become verified well after its service date (a corrected punch, a
 * late clock-out, an offline queue draining days later). A nightly "submit
 * yesterday" job would skip those permanently. Selecting on
 * `<aggregator>_status IS NULL OR 'pending'` means a visit is picked up the
 * first run after it becomes eligible, whenever that is.
 *
 * Idempotency: markSandataSubmission / markHhaexchangeSubmission move a visit
 * off 'pending', so a visit accepted by a previous run is not re-sent. A run
 * that dies mid-batch leaves the unacknowledged visits pending and the next
 * run retries them.
 */
import type { Knex } from 'knex';
import {
  AgencyHhaexchangeConfigRepository,
  AgencySandataConfigRepository,
  AuditEventRepository,
  EvvRepository,
  HhaexchangeClient,
  SandataClient,
  type AggregatorKind,
  type AggregatorSubmitResult,
  type ExportVisitRow,
  type VisitSubmission,
} from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';

/**
 * Sentinel actor uuid for cron-driven aggregator submissions (audit_events
 * requires a uuid actor). Same convention as REMITTANCE_SWEEP_ACTOR_ID.
 */
export const AGGREGATOR_SWEEP_ACTOR_ID = '00000000-0000-0000-0000-0000000000c5';

/** How far back the unattended queue reaches, in days. */
const DEFAULT_LOOKBACK_DAYS = 45;
/** Cap on visits transmitted per agency per aggregator in one run. */
const DEFAULT_MAX_VISITS_PER_AGENCY = 500;

export interface SubmitAgencyVisitsResult {
  kind: 'ok' | 'not_configured' | 'error';
  /** Aggregator batch id, present on 'ok'. */
  batchId?: string;
  submitted: number;
  accepted: number;
  rejected: number;
  /** Present on 'not_configured' and 'error'. */
  reason?: string;
  /** Present on 'error': whether the same call is worth retrying later. */
  retryable?: boolean;
}

/** Maps the export projection onto the aggregator-agnostic submission shape. */
export function toVisitSubmissions(rows: ExportVisitRow[]): VisitSubmission[] {
  return rows.map((r) => {
    const inLoc = (r.clockInLocation ?? {}) as { lat?: number; lng?: number };
    const outLoc = (r.clockOutLocation ?? {}) as { lat?: number; lng?: number };
    return {
      visitId: r.visitId,
      clientId: r.clientId ?? '',
      caregiverId: r.caregiverId,
      serviceCode: r.serviceCode ?? '',
      clockInAt: r.clockInTime,
      clockOutAt: r.clockOutTime,
      clockInLat: inLoc.lat ?? null,
      clockInLng: inLoc.lng ?? null,
      clockOutLat: outLoc.lat ?? null,
      clockOutLng: outLoc.lng ?? null,
      verificationMethod: inLoc.lat != null ? 'gps' : 'manual',
    };
  });
}

interface SubmitAgencyVisitsOptions {
  /** Audit actor. The sweep passes AGGREGATOR_SWEEP_ACTOR_ID. */
  actorId: string;
  actorType: 'user' | 'system';
  /** Free-form provenance recorded on the audit event ('manual' | 'sweep'). */
  source: string;
  /** Echoed into the audit payload when the caller filtered by date. */
  from?: string | null;
  to?: string | null;
}

/**
 * Transmit visits to one agency's aggregator and record each acknowledgment.
 * Returns 'not_configured' without sending anything when setup is incomplete,
 * so a half-configured agency never believes a batch was sent.
 *
 * `rows` accepts a loader so the caller can defer the (potentially large)
 * visit query until after the config gate passes: an agency that cannot
 * transmit should not pay for the query. The sweep passes an already-loaded
 * array because it selects agencies by pending work.
 *
 * An empty batch is still handed to the client rather than short-circuited.
 * That is deliberate: a configured-but-unimplemented transport must answer
 * with its honest "not implemented" error instead of a hollow success, and
 * the sweep already skips agencies with nothing pending before calling here.
 */
export async function submitAgencyVisits(
  db: Knex,
  agencyId: string,
  aggregator: AggregatorKind,
  rows: ExportVisitRow[] | (() => Promise<ExportVisitRow[]>),
  options: SubmitAgencyVisitsOptions,
): Promise<SubmitAgencyVisitsResult> {
  const empty = { submitted: 0, accepted: 0, rejected: 0 };
  const loadVisits = async (): Promise<VisitSubmission[]> =>
    toVisitSubmissions(typeof rows === 'function' ? await rows() : rows);

  let result: AggregatorSubmitResult;
  if (aggregator === 'sandata') {
    const config = await new AgencySandataConfigRepository(db).findSubmissionConfig(agencyId);
    if (!config) {
      return { kind: 'not_configured', reason: 'Sandata integration has not been set up for this agency', ...empty };
    }
    result = await SandataClient.submitVisits(config, await loadVisits());
  } else {
    const config = await new AgencyHhaexchangeConfigRepository(db).findSubmissionConfig(agencyId);
    if (!config) {
      return {
        kind: 'not_configured',
        reason: 'HHAeXchange integration has not been set up for this agency',
        ...empty,
      };
    }
    result = await HhaexchangeClient.submitVisits(config, await loadVisits());
  }

  if (result.kind === 'not_configured') {
    return { kind: 'not_configured', reason: result.reason, ...empty };
  }
  if (result.kind === 'error') {
    return { kind: 'error', reason: result.message, retryable: result.retryable, ...empty };
  }

  const repo = new EvvRepository(db);
  let submitted = 0;
  let accepted = 0;
  let rejected = 0;
  for (const ack of result.acks) {
    if (aggregator === 'sandata') {
      await repo.markSandataSubmission(ack.visitId, agencyId, ack.status, ack.confirmationId ?? undefined);
    } else {
      await repo.markHhaexchangeSubmission(ack.visitId, agencyId, ack.status, ack.confirmationId ?? undefined);
    }
    if (ack.status === 'accepted') accepted += 1;
    else if (ack.status === 'rejected') rejected += 1;
    else submitted += 1;
  }

  try {
    await new AuditEventRepository(db).create({
      agencyId,
      actorId: options.actorId,
      actorType: options.actorType,
      eventType: aggregator === 'sandata' ? 'evv.sandata.submitted' : 'evv.hhaexchange.submitted',
      entityType: 'evv_batch',
      entityId: agencyId,
      outcome: 'success',
      payload: {
        source: options.source,
        batchId: result.batchId,
        submitted,
        accepted,
        rejected,
        from: options.from ?? null,
        to: options.to ?? null,
      },
      occurredAt: new Date().toISOString(),
    });
  } catch (err) {
    safeError(`Failed to audit evv.${aggregator}.submitted`, err);
  }

  return { kind: 'ok', batchId: result.batchId, submitted, accepted, rejected };
}

export interface AggregatorSweepOptions {
  /** Restrict to these agencies. Omitted = every submittable agency. */
  agencyIds?: string[];
  /** Which aggregators to sweep. Default: both. */
  aggregators?: AggregatorKind[];
  /** Wall-clock stop time. The sweep finishes the agency it is on, then stops. */
  deadlineMs?: number;
  lookbackDays?: number;
  maxVisitsPerAgency?: number;
  /** Override "now" for deterministic tests. */
  now?: Date;
}

export interface AggregatorSweepSummary {
  agenciesProcessed: number;
  visitsSubmitted: number;
  visitsAccepted: number;
  visitsRejected: number;
  /** Agencies skipped because setup was incomplete at submit time. */
  notConfigured: number;
  errors: string[];
  timedOut: boolean;
}

/**
 * Sweep every submittable agency for visits still owing a transmission.
 *
 * One agency's transport failure never aborts the run: it is recorded in
 * `errors` and the sweep moves on, because a single unreachable aggregator
 * must not block every other agency's Cures Act obligation.
 */
export async function runAggregatorSubmissionSweep(
  db: Knex,
  options: AggregatorSweepOptions = {},
): Promise<AggregatorSweepSummary> {
  const aggregators = options.aggregators ?? (['sandata', 'hhaexchange'] as AggregatorKind[]);
  const lookbackDays = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const maxVisits = options.maxVisitsPerAgency ?? DEFAULT_MAX_VISITS_PER_AGENCY;
  const deadlineMs = options.deadlineMs ?? Number.POSITIVE_INFINITY;
  const now = options.now ?? new Date();
  const sinceIso = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  const summary: AggregatorSweepSummary = {
    agenciesProcessed: 0,
    visitsSubmitted: 0,
    visitsAccepted: 0,
    visitsRejected: 0,
    notConfigured: 0,
    errors: [],
    timedOut: false,
  };

  const evv = new EvvRepository(db);
  const swept = new Set<string>();

  for (const aggregator of aggregators) {
    const configured =
      aggregator === 'sandata'
        ? await new AgencySandataConfigRepository(db).listSubmittableAgencyIds()
        : await new AgencyHhaexchangeConfigRepository(db).listSubmittableAgencyIds();
    const agencyIds = options.agencyIds
      ? configured.filter((id) => options.agencyIds?.includes(id))
      : configured;

    for (const agencyId of agencyIds) {
      if (Date.now() > deadlineMs) {
        summary.timedOut = true;
        return summary;
      }

      try {
        const rows = await evv.getVisitsPendingAggregatorSubmission(agencyId, aggregator, {
          sinceIso,
          limit: maxVisits,
        });
        if (rows.length === 0) continue;

        // Counted once per agency even when it is swept for both aggregators.
        if (!swept.has(agencyId)) {
          swept.add(agencyId);
          summary.agenciesProcessed += 1;
        }

        const result = await submitAgencyVisits(db, agencyId, aggregator, rows, {
          actorId: AGGREGATOR_SWEEP_ACTOR_ID,
          actorType: 'system',
          source: 'sweep',
        });

        if (result.kind === 'not_configured') {
          summary.notConfigured += 1;
          summary.errors.push(`agency ${agencyId} (${aggregator}): ${result.reason ?? 'not configured'}`);
          continue;
        }
        if (result.kind === 'error') {
          summary.errors.push(`agency ${agencyId} (${aggregator}): ${result.reason ?? 'submission failed'}`);
          continue;
        }

        summary.visitsSubmitted += result.submitted;
        summary.visitsAccepted += result.accepted;
        summary.visitsRejected += result.rejected;
      } catch (err) {
        // Never let one agency abort the sweep. The message is the transport's
        // own text, which carries no PHI; visit ids are not interpolated here.
        const message = err instanceof Error ? err.message : 'unexpected error';
        safeError(`aggregator sweep failed for one agency (${aggregator})`, err);
        summary.errors.push(`agency ${agencyId} (${aggregator}): ${message}`);
      }
    }
  }

  return summary;
}
