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
  AvailabilityRepository,
  CaregiverRepository,
  ClaimRepository,
  ClientRepository,
  CredentialComplianceService,
  ScheduleRepository,
  checkAvailability,
  checkScheduleConflicts,
  type ConflictAuthorization,
} from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';

export interface AssignmentCheckInput {
  caregiverId: string;
  visitTemplateId: string;
  /** YYYY-MM-DD, when scheduled. */
  visitDate?: string;
  /** HH:MM pair. With a visitDate, the proposed booking gets a real window and
   *  participates in time-overlap detection; without, duplicate-rule only. */
  startTime?: string;
  endTime?: string;
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

  const hasWindow = Boolean(input.visitDate && input.startTime && input.endTime);
  const conflicts = checkScheduleConflicts({
    proposed: {
      visitTemplateId: input.visitTemplateId,
      visitDate: input.visitDate,
      // Same UTC convention the repository writes (`${date}T${HH:MM}:00.000Z`).
      scheduledStart: hasWindow ? `${input.visitDate}T${input.startTime}:00.000Z` : undefined,
      scheduledEnd: hasWindow ? `${input.visitDate}T${input.endTime}:00.000Z` : undefined,
    },
    existingAssignments,
    authorizations,
  });

  // Availability and leave. Two different weights on purpose:
  //
  //   Approved time off HARD-BLOCKS. Approving somebody's leave and then
  //   booking the shift anyway is how an agency loses staff, so it belongs
  //   with the other blocking conflicts. Only 'approved' counts; a request
  //   nobody has answered yet must not block a schedule the agency has not
  //   agreed to.
  //
  //   Declared availability only WARNS. It is a preference, not a contract,
  //   and agencies cover shifts outside someone's usual window constantly. A
  //   hard block would just get worked around by editing the availability,
  //   which would make the data worse rather than the schedule better.
  const scheduleWarnings: string[] = [];
  const scheduleBlocks: string[] = [];
  if (input.visitDate) {
    const availabilityRepo = new AvailabilityRepository(db);

    // Time off is a BLOCKING check, so this lookup is deliberately NOT
    // wrapped. If we cannot read the leave calendar we cannot honestly say
    // there is no conflict, and failing the request is far better than
    // booking a caregiver over leave the agency already approved.
    const approvedLeave = await availabilityRepo.findApprovedTimeOffOn(
      input.caregiverId,
      agencyId,
      input.visitDate,
    );
    if (approvedLeave) {
      // The reason is deliberately not echoed: it may name a medical or
      // family situation and this string lands in an API response.
      scheduleBlocks.push(
        `Caregiver has approved time off covering ${input.visitDate} (${approvedLeave.startDate} to ${approvedLeave.endDate}).`,
      );
    }

    // Availability is only ADVISORY, so a failure here degrades to "no
    // warning" rather than blocking a booking the agency is entitled to make.
    try {
      const slots = await availabilityRepo.listAvailability(input.caregiverId, agencyId);
      const verdict = checkAvailability({
        visitDate: input.visitDate,
        startTime: input.startTime,
        endTime: input.endTime,
        slots,
      });
      if (verdict.kind === 'day_unavailable' || verdict.kind === 'outside_hours') {
        scheduleWarnings.push(verdict.message);
      }
    } catch (err) {
      safeError('Could not evaluate caregiver availability', err);
    }
  }

  return {
    caregiver: { id: input.caregiverId },
    templateClient: { clientId: templateClient.clientId },
    hardConflicts: [...conflicts.hardConflicts, ...scheduleBlocks],
    credentialBlocks: credentialGate.blocks,
    warnings: [...conflicts.warnings, ...credentialGate.warnings, ...scheduleWarnings],
  };
}
