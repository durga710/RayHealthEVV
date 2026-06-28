import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import {
  AuditEventRepository,
  CaregiverRepository,
  ClaimRepository,
  ClientRepository,
  ScheduleRepository,
  assignmentInputSchema,
  checkScheduleConflicts,
  evaluateCredentialEligibility,
  type ConflictAuthorization,
} from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';

const router = Router();

router.get('/caregiver', requireCapability('schedule.read'), async (req, res) => {
  try {
    if (!req.auth.caregiverId) {
      return res.status(403).json({ message: 'User is not authorized as a caregiver' });
    }
    const db = req.app.get('db');
    const repo = new ScheduleRepository(db);
    const assignments = await repo.getAssignmentsByCaregiver(req.auth.caregiverId, req.auth.agencyId);
    res.json(assignments);
  } catch (error) {
    safeError('Failed to get caregiver assignments', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/', requireCapability('schedule.write'), async (req, res) => {
  try {
    const db = req.app.get('db');
    if (!db) {
      safeError('Database connection not found in app context');
      return res.status(500).json({ message: 'Database connection missing' });
    }
    const repo = new ScheduleRepository(db);

    const parsed = assignmentInputSchema.safeParse({
      caregiverId: req.body.caregiverId,
      visitTemplateId: req.body.visitTemplateId,
      credentialStatus: 'active' as const,
      visitDate: req.body.visitDate ?? undefined
    });
    if (!parsed.success) {
      return res.status(400).json({ message: 'Valid caregiverId and visitTemplateId are required' });
    }

    // Verify the caregiver belongs to this agency before creating the assignment.
    // Without this check an admin with a leaked caregiverId from another agency
    // could create cross-agency assignments.
    const caregiverRepo = new CaregiverRepository(db);
    const caregiver = await caregiverRepo.findById(
      parsed.data.caregiverId,
      req.auth.agencyId
    );
    if (!caregiver) {
      return res.status(403).json({ message: 'Caregiver does not belong to this agency' });
    }

    // Credential check (HHAeXchange-style): surface a warning when the caregiver
    // has non-active credentials. A warning, not a hard block, so a coordinator
    // can still schedule while a renewal is in flight — the warning rides along
    // on the response and the assignment.created audit.
    const credentials = await caregiverRepo.getCredentials(parsed.data.caregiverId, req.auth.agencyId);
    const credCheck = evaluateCredentialEligibility({
      operatingTrack: 'personal-assistance',
      credentials: credentials.map((c) => ({ credentialType: c.credentialType, status: c.status })),
    });

    // Resolve the template's client (also validates the template is in-agency).
    const templateClient = await repo.getTemplateClient(
      parsed.data.visitTemplateId,
      req.auth.agencyId
    );
    if (!templateClient) {
      return res.status(404).json({ message: 'Visit template not found in this agency' });
    }

    // Gather conflict inputs: the caregiver's existing schedule (duplicate
    // detection) and the client's authorizations with units remaining after
    // billed claims (coverage + exhaustion warnings).
    const [existingAssignments, allAuthorizations, billedUnits] = await Promise.all([
      repo.getCaregiverScheduleForConflict(parsed.data.caregiverId, req.auth.agencyId),
      new ClientRepository(db).getAuthorizations(req.auth.agencyId),
      new ClaimRepository(db).getBilledLineUnits(req.auth.agencyId),
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
      proposed: {
        visitTemplateId: parsed.data.visitTemplateId,
        visitDate: parsed.data.visitDate,
      },
      existingAssignments,
      authorizations,
    });

    if (conflicts.hardConflicts.length > 0) {
      return res.status(409).json({
        message: conflicts.hardConflicts[0],
        code: 'SCHEDULE_CONFLICT',
        conflicts: conflicts.hardConflicts,
      });
    }

    const warnings = [
      ...conflicts.warnings,
      ...(credCheck.eligible
        ? []
        : [`Caregiver has non-active credentials: ${credCheck.reasons.join(', ')}`]),
    ];

    const assignment = await repo.createAssignment(parsed.data);

    // Audit the schedule write (was previously unaudited).
    try {
      await new AuditEventRepository(db).create({
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'assignment.created',
        entityType: 'assignment',
        entityId: assignment.id,
        outcome: 'success',
        payload: {
          caregiverId: parsed.data.caregiverId,
          visitTemplateId: parsed.data.visitTemplateId,
          clientId: templateClient.clientId,
          visitDate: parsed.data.visitDate ?? null,
          warnings,
        },
        occurredAt: new Date().toISOString(),
      });
    } catch (err) {
      safeError('Failed to audit assignment.created', err);
    }

    res.status(201).json({ ...assignment, warnings });
  } catch (error) {
    safeError('Assignment creation failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.get('/', requireCapability('schedule.read'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new ScheduleRepository(db);
    // Caregivers must only see their own assignments. Without this dispatch,
    // a caregiver with `schedule.read` can dump every assignment in the agency.
    if (req.auth.role === 'caregiver') {
      if (!req.auth.caregiverId) {
        return res.status(403).json({ message: 'User is not authorized as a caregiver' });
      }
      const own = await repo.getAssignmentsByCaregiver(req.auth.caregiverId, req.auth.agencyId);
      return res.json(own);
    }
    const assignments = await repo.getAssignments(req.auth.agencyId);
    res.json(assignments);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
