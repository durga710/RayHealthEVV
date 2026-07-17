/**
 * Shared assignment safety checks used by BOTH the create (POST) and
 * reschedule/reassign (PUT) paths so the two can never drift apart. Gathers the
 * caregiver, the template's client, the client's live authorization burn-down,
 * and runs the pure schedule-conflict + credential gates. Returns the raw
 * pieces; the caller
 * decides the HTTP shaping (403 / 404 / 409 / warnings) so each route keeps its
 * existing contract.
 */
import type { Knex } from 'knex';
import {
  CaregiverRepository,
  ClaimRepository,
  ClientRepository,
  CredentialComplianceService,
  ScheduleRepository,
  checkScheduleConflicts,
  type ConflictAuthorization,
} from '@rayhealth/core';

export interface AssignmentCheckInput {
  caregiverId: string;
  visitTemplateId: string;
  /** YYYY-MM-DD, when scheduled. */
  visitDate?: string;
  /** Omit this assignment from duplicate detection (used when rescheduling it). */
  excludeAssignmentId?: string;
}

export interface AssignmentCheckResult {
  /** null = caregiver is not in this agency (caller should 403). */
  caregiver: { id: string } | null;
  /** null = visit template not found in this agency (caller should 404). */
  templateClient: { clientId: string } | null;
  /** Blocking conflicts (e.g. duplicate booking). Non-empty → caller should 409. */
  hardConflicts: string[];
  /** Expired-credential stops. Non-empty → caller should 409 CREDENTIAL_EXPIRED. */
  credentialBlocks: string[];
  /** Non-blocking advisories (coverage, exhausted units, credential follow-ups). */
  warnings: string[];
}

export async function evaluateAssignmentChecks(
  db: Knex,
  agencyId: string,
  input: AssignmentCheckInput,
): Promise<AssignmentCheckResult> {
  const scheduleRepo = new ScheduleRepository(db);
  const caregiverRepo = new CaregiverRepository(db);

  // Cross-tenant guard: the caregiver must belong to this agency.
  const caregiver = await caregiverRepo.findById(input.caregiverId, agencyId);
  if (!caregiver) {
    return { caregiver: null, templateClient: null, hardConflicts: [], credentialBlocks: [], warnings: [] };
  }

  // Credential gate: expired credentials block the booking; missing / expiring
  // soon / pending verification are advisories (see gateForBooking's rationale).
  const credentials = await caregiverRepo.getCredentials(input.caregiverId, agencyId);
  const credentialGate = new CredentialComplianceService().gateForBooking(credentials);

  // Resolve the template's client (also validates the template is in-agency).
  const templateClient = await scheduleRepo.getTemplateClient(input.visitTemplateId, agencyId);
  if (!templateClient) {
    return { caregiver: { id: input.caregiverId }, templateClient: null, hardConflicts: [], credentialBlocks: [], warnings: [] };
  }

  // Conflict inputs: the caregiver's other assignments (duplicate detection,
  // excluding the one being edited) + the client's authorizations with units
  // remaining after billed claims (coverage + exhaustion advisories).
  const [existingAssignments, allAuthorizations, billedUnits] = await Promise.all([
    scheduleRepo.getCaregiverScheduleForConflict(input.caregiverId, agencyId, input.excludeAssignmentId),
    new ClientRepository(db).getAuthorizations(agencyId),
    new ClaimRepository(db).getBilledLineUnits(agencyId),
  ]);

  const authorizations: ConflictAuthorization[] = allAuthorizations
    .filter((a) => a.clientId === templateClient.clientId)
    .map((a) => {
      const used = billedUnits
        .filter(
          (b) =>
            b.clientId === templateClient.clientId &&
            b.serviceCode === a.serviceCode &&
            b.serviceDate >= a.startDate &&
            b.serviceDate <= a.endDate,
        )
        .reduce((sum, b) => sum + b.units, 0);
      return {
        serviceCode: a.serviceCode,
        startDate: a.startDate,
        endDate: a.endDate,
        unitsAuthorized: a.unitsAuthorized,
        unitsRemaining: a.unitsAuthorized - used,
      };
    });

  const conflicts = checkScheduleConflicts({
    proposed: { visitTemplateId: input.visitTemplateId, visitDate: input.visitDate },
    existingAssignments,
    authorizations,
  });

  return {
    caregiver: { id: input.caregiverId },
    templateClient: { clientId: templateClient.clientId },
    hardConflicts: conflicts.hardConflicts,
    credentialBlocks: credentialGate.blocks,
    warnings: [...conflicts.warnings, ...credentialGate.warnings],
  };
}
