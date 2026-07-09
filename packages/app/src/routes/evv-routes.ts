import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import {
  AuditEventRepository,
  ClientRepository,
  EvvExceptionRepository,
  EvvRepository,
  ScheduleRepository,
  checkClockInWindow,
  checkGeofence,
  detectVisitExceptions,
  evvClockInInputSchema,
  evvClockOutInputSchema,
  evvServiceCodeSchema,
  evvVisitIdSchema,
  paTasks
} from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';

const router = Router();

/**
 * Build the friendly 422 envelope for a geofence violation. Distance is
 * already rounded by `checkGeofence`. Message is human-readable so the
 * mobile app can surface it directly without composing copy client-side.
 */
function geofenceRejection(envelope: { distanceM: number; allowedM: number }) {
  return {
    message: `You are ${envelope.distanceM} m from the client's address, please move closer to clock in.`,
    code: 'GEOFENCE_OUT_OF_BOUNDS' as const,
    distanceM: envelope.distanceM,
    allowedM: envelope.allowedM
  };
}

// Store-and-forward window bounds. A replayed offline punch may not claim a
// future capture time (small allowance for device clock skew) and may not be
// older than the retention window, a queue should drain well within 72h and
// anything older needs a manual VMUR correction, not a silent backdate.
const CAPTURED_AT_MAX_SKEW_MS = 5 * 60 * 1000;
const CAPTURED_AT_MAX_AGE_MS = 72 * 60 * 60 * 1000;

/**
 * Resolve the effective punch time: the client-supplied offline capture time
 * when present and within bounds, otherwise the server clock. Returns an
 * error string for out-of-window values so callers reject rather than
 * silently substituting server time (the client should hear its stamp was
 * refused).
 */
function resolvePunchTime(capturedAt: string | undefined): { time: string } | { error: string } {
  if (!capturedAt) return { time: new Date().toISOString() };
  const captured = Date.parse(capturedAt);
  const now = Date.now();
  if (captured > now + CAPTURED_AT_MAX_SKEW_MS) {
    return { error: 'capturedAt is in the future' };
  }
  if (captured < now - CAPTURED_AT_MAX_AGE_MS) {
    return { error: 'capturedAt is older than the 72h offline window; file a visit correction instead' };
  }
  return { time: new Date(captured).toISOString() };
}

router.get('/visits', requireCapability('evv.read'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new EvvRepository(db);
    // Caregivers see only their own visits. Admin / coordinator / family
    // get the agency scope. Tenant isolation is enforced inside the repo
    // via JOIN on users.agency_id.
    const visits =
      req.auth.role === 'caregiver' && req.auth.caregiverId
        ? await repo.getVisitsForCaregiver(req.auth.caregiverId)
        : await repo.getVisitsForAgency(req.auth.agencyId);
    res.json(visits);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * Lightweight count for dashboard tiles, a SQL COUNT instead of shipping every
 * (PHI-bearing) visit row to the client just to read its length.
 */
router.get('/visits/count', requireCapability('evv.read'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const repo = new EvvRepository(db);
    const count =
      req.auth.role === 'caregiver' && req.auth.caregiverId
        ? (await repo.getVisitsForCaregiver(req.auth.caregiverId)).length
        : await repo.countVisitsForAgency(req.auth.agencyId);
    res.json({ count });
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/clock-in', requireCapability('evv.write'), async (req, res) => {
  try {
    if (!req.auth.caregiverId) return res.status(403).json({ message: 'User is not authorized as a caregiver' });

    const parsed = evvClockInInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: 'Valid assignmentId and GPS location are required' });

    const db = req.app.get('db');
    const repo = new EvvRepository(db);
    const scheduleRepo = new ScheduleRepository(db);
    // Resolve client_id (Cures-Act #2, beneficiary) from the assignment's
    // visit_template. Snapshotting it onto the visit row keeps the row
    // self-contained for aggregator submission and audit.
    const assignment = await scheduleRepo.getAssignmentForCaregiver(
      parsed.data.assignmentId,
      req.auth.caregiverId,
      req.auth.agencyId
    );
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    // Geofence gate. Pulls the client's anchor + radius (tenant-scoped) and
    // compares against the GPS lat/lng captured by the mobile app. Fails
    // open when the client has no registered coordinates, see
    // checkGeofence() docstring for the rationale.
    const clientRepo = new ClientRepository(db);
    const clientGeofence = await clientRepo.getClientGeofence(
      assignment.clientId,
      req.auth.agencyId
    );
    if (clientGeofence) {
      const violation = checkGeofence(parsed.data.location, clientGeofence);
      if (violation) {
        // Audit out-of-bounds attempts so the policy gap is observable , 
        // a caregiver hammering clock-in from a single off-site location
        // shows up as repeated permission.denied rows on the assignment.
        try {
          await new AuditEventRepository(db).create({
            agencyId: req.auth.agencyId,
            actorId: req.auth.userId,
            actorType: 'user',
            eventType: 'permission.denied',
            entityType: 'evv.clock-in',
            entityId: parsed.data.assignmentId,
            outcome: 'denied',
            payload: {
              reason: 'geofence',
              distanceM: violation.distanceM,
              allowedM: violation.allowedM
            },
            occurredAt: new Date().toISOString()
          });
        } catch (err) {
          safeError('Failed to record geofence audit event', err);
        }
        return res.status(422).json(geofenceRejection(violation));
      }
    }

    const authorizedServiceCode = assignment.serviceCode
      ? evvServiceCodeSchema.safeParse(assignment.serviceCode)
      : null;
    if (assignment.serviceCode && !authorizedServiceCode?.success) {
      return res.status(400).json({ message: 'Assignment authorization service code is not supported for PA EVV' });
    }
    if (
      authorizedServiceCode?.success &&
      parsed.data.serviceCode &&
      authorizedServiceCode.data !== parsed.data.serviceCode
    ) {
      return res.status(400).json({ message: 'serviceCode does not match the client authorization' });
    }
    const serviceCode = authorizedServiceCode?.success ? authorizedServiceCode.data : parsed.data.serviceCode;
    if (!serviceCode) {
      // Cures-Act #1, service code is mandatory at clock-in. Refuse rather
      // than silently NULLing it; downstream aggregator submission will reject
      // a visit row without a service code anyway.
      return res.status(400).json({ message: 'serviceCode (HCPCS) is required at clock-in' });
    }

    // Reject a second concurrent clock-in on the same assignment. Duplicate
    // prevention lived only in the mobile client, so a direct/replayed API call
    // (or a retry after a slow response) could open several overlapping visits,
    // each independently clockable-out → overlapping/duplicate billed EVV time.
    // Return the existing open visit so the client can resume it rather than
    // creating a new one.
    const openVisit = await repo.findOpenVisitForAssignment(parsed.data.assignmentId);
    if (openVisit) {
      return res.status(409).json({
        message: 'An open visit already exists for this assignment.',
        code: 'VISIT_ALREADY_OPEN',
        visit: openVisit,
      });
    }

    // Offline store-and-forward punches replay with their original capture
    // time so the visit reflects when care actually started, not when the
    // phone regained signal. created_at (server time) preserves the sync lag.
    const punchTime = resolvePunchTime(parsed.data.capturedAt);
    if ('error' in punchTime) return res.status(400).json({ message: punchTime.error });

    // Time-window gate: clock-in opens shortly before the scheduled start and
    // closes at the scheduled end. Placed AFTER the open-visit 409 so a
    // caregiver resuming an overrunning open visit always wins, and evaluated
    // on the resolved punch time so an in-window offline punch synced later
    // still lands. Fails open for assignments without a real schedule (see
    // checkClockInWindow docs).
    const windowViolation = checkClockInWindow(
      punchTime.time,
      assignment.scheduledStartTime ?? null,
      assignment.scheduledEndTime ?? null
    );
    if (windowViolation) {
      try {
        await new AuditEventRepository(db).create({
          agencyId: req.auth.agencyId,
          actorId: req.auth.userId,
          actorType: 'user',
          eventType: 'permission.denied',
          entityType: 'evv.clock-in',
          entityId: parsed.data.assignmentId,
          outcome: 'denied',
          payload: {
            reason: 'clock-in-window',
            windowReason: windowViolation.reason,
            punchTime: punchTime.time,
            opensAt: windowViolation.opensAt,
            closesAt: windowViolation.closesAt
          },
          occurredAt: new Date().toISOString()
        });
      } catch (err) {
        safeError('Failed to record clock-in-window audit event', err);
      }
      return res.status(422).json({
        message:
          windowViolation.reason === 'too-early'
            ? 'This visit is not open for clock-in yet. Clock-in opens 5 minutes before the scheduled start.'
            : "This visit's scheduled time has ended, so it can no longer be clocked into. Contact your coordinator if you provided this care.",
        code: 'OUTSIDE_CLOCK_IN_WINDOW' as const,
        reason: windowViolation.reason,
        opensAt: windowViolation.opensAt,
        closesAt: windowViolation.closesAt,
        scheduledStartTime: assignment.scheduledStartTime ?? null,
        scheduledEndTime: assignment.scheduledEndTime ?? null
      });
    }

    const visit = await repo.createVisit({
      assignmentId: parsed.data.assignmentId,
      caregiverId: req.auth.caregiverId,
      clientId: assignment.clientId,
      serviceCode,
      clockInTime: punchTime.time,
      clockInLocation: parsed.data.location,
      status: 'pending'
    });
    res.status(201).json(visit);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.post('/clock-out/:id', requireCapability('evv.write'), async (req, res) => {
  try {
    if (!req.auth.caregiverId) return res.status(403).json({ message: 'User is not authorized as a caregiver' });
    const rawId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const id = evvVisitIdSchema.safeParse(rawId);
    const parsed = evvClockOutInputSchema.safeParse(req.body ?? {});
    if (!id.success || !parsed.success) {
      return res.status(400).json({ message: 'Valid visit id and GPS location are required' });
    }

    // Resolve documented task IDs against the PA task catalog and snapshot
    // {id, duty} onto the visit (self-contained for audit packet/aggregator,
    // same philosophy as the clock-in service-code snapshot). Unknown codes
    // are rejected rather than silently dropped, a client sending garbage
    // should hear about it before the visit is closed.
    let tasks: Array<{ id: string; duty: string }> | undefined;
    if (parsed.data.taskIds && parsed.data.taskIds.length > 0) {
      const catalog = new Map(paTasks.map((t) => [t.id, t]));
      const unknown = parsed.data.taskIds.filter((taskId) => !catalog.has(taskId));
      if (unknown.length > 0) {
        return res.status(400).json({
          message: `Unknown task code(s): ${unknown.join(', ')}`,
          code: 'UNKNOWN_TASK_CODE'
        });
      }
      tasks = [...new Set(parsed.data.taskIds)].map((taskId) => {
        const t = catalog.get(taskId)!;
        return { id: t.id, duty: t.duty };
      });
    }
    const visitNote = parsed.data.note ? parsed.data.note : undefined;

    const db = req.app.get('db');
    const repo = new EvvRepository(db);
    const existing = await repo.getVisitByIdForAgency(id.data, req.auth.agencyId);
    if (!existing || existing.caregiverId !== req.auth.caregiverId) {
      return res.status(404).json({ message: 'Visit not found' });
    }

    // Idempotent no-op on a repeat call (double-tap, client retry after a
    // slow response, or a stale client screen re-showing a finished visit as
    // resumable). Without this, every repeat call re-ran geofence/exception
    // detection and overwrote clock_out_time/clock_out_location with a fresh
    // value, silently discarding the original clock-out and, if any
    // exception was detected, filing a duplicate exception + audit row per
    // call. Return the already-completed record unchanged instead.
    if (existing.clockOutTime) {
      return res.json(existing);
    }

    // Geofence gate at clock-out. Same fail-open semantics as clock-in.
    // Visit rows carry `clientId` since the Cures-Act #2 snapshot rollout;
    // older rows without it skip the geofence check (the alternative is to
    // re-resolve via the assignment, which costs an extra query for a
    // legacy edge case that's been migrated).
    if (existing.clientId) {
      const clientRepo = new ClientRepository(db);
      const clientGeofence = await clientRepo.getClientGeofence(
        existing.clientId,
        req.auth.agencyId
      );
      if (clientGeofence) {
        const violation = checkGeofence(parsed.data.location, clientGeofence);
        if (violation) {
          try {
            await new AuditEventRepository(db).create({
              agencyId: req.auth.agencyId,
              actorId: req.auth.userId,
              actorType: 'user',
              eventType: 'permission.denied',
              entityType: 'evv.clock-out',
              entityId: id.data,
              outcome: 'denied',
              payload: {
                reason: 'geofence',
                distanceM: violation.distanceM,
                allowedM: violation.allowedM
              },
              occurredAt: new Date().toISOString()
            });
          } catch (err) {
            safeError('Failed to record geofence audit event', err);
          }
          return res.status(422).json(geofenceRejection(violation));
        }
      }
    }

    // Offline store-and-forward: honor the original capture time within the
    // window, and never let a clock-out land before its own clock-in.
    const punchTime = resolvePunchTime(parsed.data.capturedAt);
    if ('error' in punchTime) return res.status(400).json({ message: punchTime.error });
    if (Date.parse(punchTime.time) <= Date.parse(existing.clockInTime)) {
      return res.status(400).json({ message: 'capturedAt is before this visit clocked in' });
    }
    const clockOutTime = punchTime.time;

    // Best-effort scheduled-start lookup for late-clock-in detection.
    let scheduledStartTime: string | null = null;
    try {
      const assignmentRow = await db('assignments')
        .where({ id: existing.assignmentId })
        .first('scheduled_start_time');
      const raw = assignmentRow?.scheduled_start_time;
      scheduledStartTime = raw ? new Date(raw).toISOString() : null;
    } catch (err) {
      safeError('Failed to load scheduled start for late-clock-in detection', err);
    }

    // Run the six-element / timing compliance check on the completed visit.
    // Real exceptions (missing or degraded GPS, late clock-in) flag the visit
    // and file rows into the exception queue instead of rubber-stamping it
    // 'verified'. A clean visit verifies as before.
    const completedVisit = {
      ...existing,
      clockOutTime,
      clockOutLocation: parsed.data.location
    };
    const detected = detectVisitExceptions(completedVisit, { scheduledStartTime });
    const status = detected.length > 0 ? 'flagged' : 'verified';

    // updateVisit returns null when the visit is on another tenant OR does
    // not exist. Both surface as 404, we never confirm cross-tenant existence.
    // Verification-of-service signature: stored with the punch moment as its
    // signing time (identical for online punches; the original capture time
    // for offline store-and-forward ones).
    const signature = parsed.data.signature
      ? {
          ...parsed.data.signature,
          signerName: parsed.data.signature.signerName ?? null,
          signedAt: clockOutTime
        }
      : undefined;

    const visit = await repo.updateVisit(id.data, req.auth.agencyId, {
      clockOutTime,
      clockOutLocation: parsed.data.location,
      status,
      ...(tasks ? { tasks } : {}),
      ...(visitNote ? { visitNote } : {}),
      ...(signature ? { signature } : {})
    });
    if (!visit) return res.status(404).json({ message: 'Visit not found' });

    // Persist exceptions + audit the flagging. Best-effort: a logging failure
    // must not roll back an already-recorded visit.
    if (detected.length > 0) {
      try {
        const exceptionRepo = new EvvExceptionRepository(db);
        for (const ex of detected) {
          await exceptionRepo.create({
            visitId: id.data,
            exceptionType: ex.exceptionType,
            reason: ex.reason
          });
        }
        await new AuditEventRepository(db).create({
          agencyId: req.auth.agencyId,
          actorId: req.auth.userId,
          actorType: 'user',
          eventType: 'exception.filed',
          entityType: 'evv.visit',
          entityId: id.data,
          outcome: 'success',
          payload: {
            exceptions: detected.map((e) => ({ type: e.exceptionType, reason: e.reason }))
          },
          occurredAt: new Date().toISOString()
        });
      } catch (err) {
        safeError('Failed to persist EVV exceptions', err);
      }
    }

    res.json(visit);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;
