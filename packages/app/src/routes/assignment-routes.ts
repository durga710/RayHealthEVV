import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import {
  AuditEventRepository,
  CaregiverRepository,
  ScheduleRepository,
  assignmentInputSchema,
} from '@rayhealth/core';
import { evaluateAssignmentChecks } from './assignment-checks.js';
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

    // Run the shared safety checks (cross-tenant caregiver guard, credential
    // advisory, template→client resolution, duplicate-booking + authorization
    // coverage gate). Same logic the reschedule path uses, so the two can't drift.
    const checks = await evaluateAssignmentChecks(db, req.auth.agencyId, {
      caregiverId: parsed.data.caregiverId,
      visitTemplateId: parsed.data.visitTemplateId,
      visitDate: parsed.data.visitDate,
    });

    if (!checks.caregiver) {
      return res.status(403).json({ message: 'Caregiver does not belong to this agency' });
    }
    if (!checks.templateClient) {
      return res.status(404).json({ message: 'Visit template not found in this agency' });
    }
    if (checks.hardConflicts.length > 0) {
      return res.status(409).json({
        message: checks.hardConflicts[0],
        code: 'SCHEDULE_CONFLICT',
        conflicts: checks.hardConflicts,
      });
    }

    const warnings = checks.warnings;
    const templateClient = checks.templateClient;

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

router.put('/:id', requireCapability('schedule.write'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new ScheduleRepository(db);

    const { caregiverId, visitTemplateId, visitDate } = req.body ?? {};
    const patch: { caregiverId?: string; visitTemplateId?: string; visitDate?: string | null } = {};

    // A reassigned caregiver / template must belong to this agency, same
    // cross-tenant guard the create path enforces.
    if (caregiverId !== undefined) {
      if (typeof caregiverId !== 'string' || !caregiverId) {
        return res.status(400).json({ message: 'caregiverId must be a non-empty string' });
      }
      const caregiver = await new CaregiverRepository(db).findById(caregiverId, req.auth.agencyId);
      if (!caregiver) {
        return res.status(403).json({ message: 'Caregiver does not belong to this agency' });
      }
      patch.caregiverId = caregiverId;
    }
    if (visitTemplateId !== undefined) {
      if (typeof visitTemplateId !== 'string' || !visitTemplateId) {
        return res.status(400).json({ message: 'visitTemplateId must be a non-empty string' });
      }
      const templateClient = await repo.getTemplateClient(visitTemplateId, req.auth.agencyId);
      if (!templateClient) {
        return res.status(404).json({ message: 'Visit template not found in this agency' });
      }
      patch.visitTemplateId = visitTemplateId;
    }
    if (visitDate !== undefined) {
      if (visitDate !== null && (typeof visitDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(visitDate))) {
        return res.status(400).json({ message: 'visitDate must be YYYY-MM-DD or null' });
      }
      patch.visitDate = visitDate;
    }

    // Re-run the conflict gate on the EFFECTIVE assignment (current values with
    // the patch applied) so a reschedule/reassign can't silently create a
    // double-booking or push past authorized units, the create path enforces
    // this, the edit path must too. Self-excluded from duplicate detection.
    const assignmentId = String(req.params.id);
    const current = await repo.getAssignmentById(assignmentId, req.auth.agencyId);
    if (!current) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const checks = await evaluateAssignmentChecks(db, req.auth.agencyId, {
      caregiverId: patch.caregiverId ?? current.caregiverId,
      visitTemplateId: patch.visitTemplateId ?? current.visitTemplateId,
      visitDate: patch.visitDate !== undefined ? (patch.visitDate ?? undefined) : current.visitDate,
      excludeAssignmentId: assignmentId,
    });
    if (checks.hardConflicts.length > 0) {
      return res.status(409).json({
        message: checks.hardConflicts[0],
        code: 'SCHEDULE_CONFLICT',
        conflicts: checks.hardConflicts,
      });
    }

    const updated = await repo.updateAssignment(assignmentId, req.auth.agencyId, patch);
    if (!updated) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    res.json({ ...updated, warnings: checks.warnings });
  } catch (error) {
    safeError('Assignment update failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.delete('/:id', requireCapability('schedule.write'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new ScheduleRepository(db);
    const result = await repo.deleteAssignment(String(req.params.id), req.auth.agencyId);
    if (result === 'not_found') {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    if (result === 'has_dependencies') {
      return res.status(409).json({
        message: 'This assignment already has an EVV visit and cannot be deleted.',
        code: 'HAS_DEPENDENCIES',
      });
    }
    res.status(204).end();
  } catch (error) {
    safeError('Assignment delete failed', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
