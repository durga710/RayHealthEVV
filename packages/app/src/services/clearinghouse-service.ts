/**
 * Clearinghouse orchestration for the app layer.
 *
 * Three responsibilities:
 *   - buildTransportForAgency: load the agency's decrypted clearinghouse
 *     config and construct the right transport (sandbox transports get a
 *     claim source wired to the agency's submitted claims).
 *   - build837ForClaim: the 837P assembly shared by the download route and
 *     the automated submit route (extracted from the download route with no
 *     behavior change).
 *   - runRemittanceSweep: pull 835 files for one or many agencies, skip
 *     files already in the ledger (content sha256), post the rest through
 *     the REAL parse835 + postEra path, and record them. Time-boxed so a
 *     cron invocation stays well inside the serverless duration cap.
 */
import type { Knex } from 'knex';
import {
  AgencyClearinghouseConfigRepository,
  AuditEventRepository,
  ClaimRepository,
  ClearinghouseRemittanceFileRepository,
  createClearinghouseTransport,
  generate837P,
  parse835,
  type Claim,
  type ClearinghouseTransport,
  type Edi837Claim,
} from '@rayhealth/core';

/**
 * Sentinel actor uuid for cron-driven remittance postings (audit_events
 * requires a uuid actor). Same convention as SUPER_ADMIN_ACTOR_ID.
 */
export const REMITTANCE_SWEEP_ACTOR_ID = '00000000-0000-0000-0000-0000000000c4';

export type TransportForAgency =
  | { kind: 'not_configured'; reason: string }
  | { kind: 'ok'; transport: ClearinghouseTransport; transportName: string };

export async function buildTransportForAgency(db: Knex, agencyId: string): Promise<TransportForAgency> {
  const config = await new AgencyClearinghouseConfigRepository(db).findSubmissionConfig(agencyId);
  if (!config) {
    return { kind: 'not_configured', reason: 'Clearinghouse integration is not configured for this agency' };
  }
  const result = createClearinghouseTransport(config, {
    sandboxClaims: async () => {
      const { rows } = await new ClaimRepository(db).listClaims(agencyId, { status: 'submitted', limit: 500 });
      return rows
        .filter((c) => typeof c.controlNumber === 'string' && c.controlNumber.length > 0)
        .map((c) => ({ controlNumber: c.controlNumber as string, totalChargeCents: c.totalChargeCents }));
    },
  });
  if (result.kind === 'not_configured') return result;
  return { kind: 'ok', transport: result.transport, transportName: result.transport.name };
}

export type Build837Result =
  | { kind: 'ok'; edi: string; controlNumber: string }
  | { kind: 'no_profile' }
  | { kind: 'profile_incomplete'; missing: string[] };

/**
 * Assemble the X12 837P for one claim. Extracted from the 837 download route;
 * both the download and the automated submission must emit the identical file.
 */
export async function build837ForClaim(db: Knex, agencyId: string, claim: Claim): Promise<Build837Result> {
  const repo = new ClaimRepository(db);
  const [profile, clientInfo, renderingProviders] = await Promise.all([
    repo.getAgencyBillingProfile(agencyId),
    repo.getClientBillingInfo(agencyId, [claim.clientId]),
    repo.getVisitRenderingProviders(claim.lines.map((l) => l.visitId)),
  ]);
  if (!profile) return { kind: 'no_profile' };

  // A clearinghouse / PA Medicaid rejects an 837 with an empty billing
  // provider. Refuse to emit a structurally-invalid file; tell the admin
  // exactly which Billing & Clearinghouse fields to complete first.
  const requiredProfile: Array<[keyof typeof profile, string]> = [
    ['npi', 'Billing NPI'],
    ['taxId', 'Tax ID (EIN)'],
    ['address1', 'Service address'],
    ['city', 'City'],
    ['state', 'State'],
    ['postalCode', 'ZIP code'],
  ];
  const missing = requiredProfile
    .filter(([key]) => !String(profile[key] ?? '').trim())
    .map(([, label]) => label);
  if (missing.length > 0) return { kind: 'profile_incomplete', missing };

  const client = clientInfo.get(claim.clientId);
  const submitterId = profile.clearinghouseId || profile.medicaidProviderNumber || 'RAYHEALTH';
  const controlNumber = claim.controlNumber ?? (claim.id as string).slice(0, 12);

  const edi837Claim: Edi837Claim = {
    controlNumber,
    subscriber: {
      firstName: client?.firstName ?? '',
      lastName: client?.lastName ?? '',
      memberId: client?.medicaidNumber ?? '',
      dateOfBirth: client?.dateOfBirth,
      gender: 'U',
      payerName: claim.payerId,
      payerId: claim.payerId,
    },
    placeOfService: '12',
    // ICD-10-CM diagnosis codes, principal first. Sourced from the claim when
    // present; when the agency hasn't captured a diagnosis the generator emits
    // no HI segment and no dangling diagnosis pointer (the payer will still
    // reject for the missing diagnosis, which surfaces the data gap honestly
    // rather than producing a silently-malformed file).
    diagnosisCodes: (claim as { diagnosisCodes?: string[] }).diagnosisCodes ?? [],
    lines: claim.lines.map((l) => {
      const rp = renderingProviders.get(l.visitId);
      return {
        serviceCode: l.serviceCode,
        chargeCents: l.chargeCents,
        units: l.units,
        serviceDate: l.serviceDate,
        renderingProviderNpi: rp?.npi || undefined,
        renderingProviderLastName: rp?.lastName,
        renderingProviderFirstName: rp?.firstName,
      };
    }),
  };

  const result = generate837P({
    submitter: { name: profile.name, id: submitterId, contactPhone: '' },
    receiver: { name: claim.payerId, id: profile.clearinghouseId || claim.payerId },
    billingProvider: {
      organizationName: profile.name,
      npi: profile.npi,
      taxId: profile.taxId,
      address1: profile.address1,
      city: profile.city,
      state: profile.state,
      postalCode: profile.postalCode,
      taxonomyCode: profile.taxonomyCode,
    },
    claims: [edi837Claim],
    control: {
      usageIndicator: 'T',
      interchangeControlNumber: claim.controlNumber?.replace(/\D/g, '').slice(0, 9) || '1',
    },
  });

  return { kind: 'ok', edi: result.edi, controlNumber };
}

export interface SweepOptions {
  agencyIds: string[];
  maxFilesPerAgency?: number;
  deadlineMs: number;
}

export interface SweepSummary {
  agenciesProcessed: number;
  filesIngested: number;
  filesSkipped: number;
  claimsMatched: number;
  errors: string[];
  timedOut: boolean;
}

export async function runRemittanceSweep(db: Knex, options: SweepOptions): Promise<SweepSummary> {
  const maxFiles = options.maxFilesPerAgency ?? 5;
  const summary: SweepSummary = {
    agenciesProcessed: 0,
    filesIngested: 0,
    filesSkipped: 0,
    claimsMatched: 0,
    errors: [],
    timedOut: false,
  };
  const ledger = new ClearinghouseRemittanceFileRepository(db);
  const claims = new ClaimRepository(db);
  const auditRepo = new AuditEventRepository(db);

  for (const agencyId of options.agencyIds) {
    if (Date.now() > options.deadlineMs) {
      summary.timedOut = true;
      break;
    }

    const built = await buildTransportForAgency(db, agencyId);
    if (built.kind === 'not_configured') {
      // Enabled-but-incomplete configs land here; surface without failing the run.
      summary.errors.push(`agency ${agencyId}: ${built.reason}`);
      continue;
    }
    summary.agenciesProcessed += 1;

    const fetched = await built.transport.fetchRemittances({ maxFiles });
    if (fetched.kind === 'error') {
      summary.errors.push(`agency ${agencyId}: ${fetched.message}`);
      continue;
    }

    for (const file of fetched.files) {
      if (Date.now() > options.deadlineMs) {
        summary.timedOut = true;
        break;
      }
      try {
        if (await ledger.hasIngested(agencyId, file.sha256)) {
          summary.filesSkipped += 1;
          continue;
        }
        const era = parse835(file.content);
        const result = await claims.postEra(agencyId, era);
        // Ledger row only after a successful post, so a failed post retries
        // on the next sweep.
        await ledger.record({
          agencyId,
          fileName: file.name,
          sha256: file.sha256,
          transport: built.transportName,
          claimCount: era.claims.length,
          matchedCount: result.matched,
          totalPaidCents: era.totalPaidCents,
          traceNumber: era.traceNumber,
        });
        summary.filesIngested += 1;
        summary.claimsMatched += result.matched;

        try {
          await auditRepo.create({
            agencyId,
            actorId: REMITTANCE_SWEEP_ACTOR_ID,
            actorType: 'system',
            eventType: 'claim.remittance.posted',
            entityType: 'remittance',
            entityId: agencyId,
            outcome: 'success',
            occurredAt: new Date().toISOString(),
            payload: {
              source: 'sweep',
              transport: built.transportName,
              fileName: file.name,
              claimCount: era.claims.length,
              matched: result.matched,
              totalPaidCents: era.totalPaidCents,
            },
          });
        } catch {
          // Best effort; the posting itself already succeeded.
        }
      } catch (err) {
        summary.errors.push(
          `agency ${agencyId} file ${file.name}: ${err instanceof Error ? err.message : 'ingest failed'}`,
        );
      }
    }
  }

  return summary;
}
