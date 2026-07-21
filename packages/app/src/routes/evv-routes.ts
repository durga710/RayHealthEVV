import { createHash } from 'node:crypto';
import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { askAI, isAIConfigured, AINotConfiguredError } from '../ai.js';
import {
  AuditEventRepository,
  ClientRepository,
  EvvExceptionRepository,
  EvvRepository,
  ScheduleRepository,
  VisitTaskCompletionRepository,
  checkClockInWindow,
  checkGeofence,
  detectVisitExceptions,
  evvClockInInputSchema,
  evvClockOutInputSchema,
  evvServiceCodeSchema,
  evvVisitIdSchema,
  paTasks,
  visitTaskCompletionBatchSchema
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

router.get('/visits/:id/tasks', requireCapability('evv.read'), async (req, res) => {
  try {
    const rawId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const id = evvVisitIdSchema.safeParse(rawId);
    if (!id.success) return res.status(400).json({ message: 'Valid visit id is required' });

    const db = req.app.get('db');
    const visit = await new EvvRepository(db).getVisitByIdForAgency(id.data, req.auth.agencyId);
    if (!visit) return res.status(404).json({ message: 'Visit not found' });
    if (req.auth.role === 'caregiver' && visit.caregiverId !== req.auth.caregiverId) {
      return res.status(404).json({ message: 'Visit not found' });
    }

    const result = await new VisitTaskCompletionRepository(db).getForVisit(id.data, req.auth.agencyId);
    res.json(result);
  } catch (error) {
    safeError('Failed to load visit task completion state', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.put('/visits/:id/tasks', requireCapability('evv.write'), async (req, res) => {
  try {
    if (!req.auth.caregiverId) {
      return res.status(403).json({ message: 'User is not authorized as a caregiver' });
    }
    const rawId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const id = evvVisitIdSchema.safeParse(rawId);
    const parsed = visitTaskCompletionBatchSchema.safeParse(req.body ?? {});
    if (!id.success || !parsed.success) {
      return res.status(400).json({ message: 'Valid visit id and task completions are required' });
    }

    const db = req.app.get('db');
    const visit = await new EvvRepository(db).getVisitByIdForAgency(id.data, req.auth.agencyId);
    if (!visit || visit.caregiverId !== req.auth.caregiverId) {
      return res.status(404).json({ message: 'Visit not found' });
    }

    const repo = new VisitTaskCompletionRepository(db);
    const current = await repo.getForVisit(id.data, req.auth.agencyId);
    const allowed = new Set(
      current.plan.map((task) => `${task.taskCode ?? ''}:${task.taskLabel.toLowerCase()}`),
    );
    const hasUnknownTask = parsed.data.completions.some(
      (task) => !allowed.has(`${task.taskCode ?? ''}:${task.taskLabel.toLowerCase()}`),
    );
    if (hasUnknownTask) {
      return res.status(422).json({ message: 'Every completion must match the visit care plan' });
    }

    const completions = await repo.upsertBatch({
      agencyId: req.auth.agencyId,
      visitId: id.data,
      caregiverId: req.auth.caregiverId,
      completions: parsed.data.completions,
    });

    const statusCounts = completions.reduce<Record<string, number>>((counts, item) => {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
      return counts;
    }, {});
    try {
      await new AuditEventRepository(db).create({
        agencyId: req.auth.agencyId,
        actorId: req.auth.userId,
        actorType: 'user',
        eventType: 'evv.tasks.completed',
        entityType: 'evv.visit',
        entityId: id.data,
        outcome: 'success',
        payload: { completionCount: completions.length, statusCounts },
        occurredAt: new Date().toISOString(),
      });
    } catch (error) {
      safeError('Failed to audit visit task completions', error);
    }

    res.json({ completions });
  } catch (error) {
    safeError('Failed to persist visit task completions', error);
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
    // Offline replay idempotency: a queued punch that already synced returns
    // the visit it created instead of opening a duplicate.
    if (parsed.data.clientEventId) {
      const replay = await repo.getVisitByClockInClientEvent(
        parsed.data.clientEventId,
        req.auth.agencyId,
        req.auth.caregiverId,
      );
      if (replay) return res.json(replay);
    }
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
      id: parsed.data.visitId,
      assignmentId: parsed.data.assignmentId,
      caregiverId: req.auth.caregiverId,
      clientId: assignment.clientId,
      serviceCode,
      clockInTime: punchTime.time,
      clockInClientEventId: parsed.data.clientEventId,
      clockInCaptureMode: parsed.data.captureMode ?? 'online',
      clockInLocation: parsed.data.location,
      status: 'pending'
    });
    if (parsed.data.captureMode === 'offline') {
      try {
        await new AuditEventRepository(db).create({
          agencyId: req.auth.agencyId,
          actorId: req.auth.userId,
          actorType: 'user',
          eventType: 'evv.offline.synced',
          entityType: 'evv.clock-in',
          entityId: visit.id!,
          outcome: 'success',
          payload: { capturedAt: punchTime.time, receivedAt: new Date().toISOString() },
          occurredAt: new Date().toISOString(),
        });
      } catch (error) {
        safeError('Failed to audit offline EVV clock-in sync', error);
      }
    }
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
      clockOutClientEventId: parsed.data.clientEventId,
      clockOutCaptureMode: parsed.data.captureMode ?? 'online',
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

    if (parsed.data.captureMode === 'offline') {
      try {
        await new AuditEventRepository(db).create({
          agencyId: req.auth.agencyId,
          actorId: req.auth.userId,
          actorType: 'user',
          eventType: 'evv.offline.synced',
          entityType: 'evv.clock-out',
          entityId: id.data,
          outcome: 'success',
          payload: { capturedAt: clockOutTime, receivedAt: new Date().toISOString() },
          occurredAt: new Date().toISOString(),
        });
      } catch (error) {
        safeError('Failed to audit offline EVV clock-out sync', error);
      }
    }

    res.json(visit);
  } catch {
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

/**
 * AI visit-note polish.
 *
 * Turns the caregiver's rough clock-out note into a clear, professional
 * visit note. The draft is a SUGGESTION only: it is returned to the client,
 * shown for review, and never written to the visit record here — the note
 * lands on the EVV record exclusively through the existing clock-out path,
 * after the caregiver has accepted/edited it. That review-then-submit shape
 * is the human-approval gate for AI-assisted documentation.
 *
 * Bedrock (Claude, BAA-covered) is the only provider; when it is not
 * configured this fails closed with 503 instead of routing PHI elsewhere
 * (same policy as the copilot, see ../ai.ts).
 *
 * Audit: writes evv.note.draft with a hash of the rough note (not the text —
 * notes contain PHI; the hash is a correlation ID without retention
 * liability), model id, and sizes.
 */
const DRAFT_NOTE_SYSTEM_PROMPT = `You rewrite a home-care caregiver's rough visit note into a clear, professional note for the agency office.

Rules, in priority order:
1. NEVER add facts. Do not invent observations, measurements, vitals, times, symptoms, moods, or events that are not in the caregiver's note. If the note is thin, the rewrite stays thin.
2. Never diagnose or use clinical terms the caregiver did not use.
3. Preserve safety-relevant content plainly: falls, injuries, skin changes, medication refusals, missed meals, and anything the caregiver flagged as a concern must survive the rewrite, stated factually.
4. Write in first person, past tense, objective tone ("Client expressed frustration about the medication schedule", not "Client was mad about meds").
5. Keep names, relationships, and task references exactly as given.
6. Maximum 120 words. Plain text only — no headings, lists, quotes, or commentary about the rewrite.
Return only the rewritten note.`;

router.post('/draft-note', requireCapability('evv.write'), async (req, res) => {
  if (!req.auth.caregiverId) {
    return res.status(403).json({ message: 'User is not authorized as a caregiver' });
  }

  const body = (req.body ?? {}) as { roughNote?: unknown; taskDuties?: unknown; clientName?: unknown };
  const roughNote = typeof body.roughNote === 'string' ? body.roughNote.trim() : '';
  if (!roughNote) {
    return res.status(400).json({ message: 'roughNote is required' });
  }
  if (roughNote.length > 2000) {
    return res.status(400).json({ message: 'roughNote exceeds 2000 characters' });
  }
  const taskDuties = Array.isArray(body.taskDuties)
    ? body.taskDuties.filter((d): d is string => typeof d === 'string' && d.length <= 200).slice(0, 30)
    : [];
  const clientName =
    typeof body.clientName === 'string' && body.clientName.length <= 120 ? body.clientName.trim() : '';

  if (!isAIConfigured()) {
    return res.status(503).json({
      message: 'AI note drafting is unavailable right now. Your note will be saved as written.',
      code: 'AI_NOT_CONFIGURED' as const
    });
  }

  try {
    const contextLines = [
      clientName ? `Client first name (use as given): ${clientName}` : null,
      taskDuties.length > 0 ? `Tasks the caregiver checked off this visit:\n- ${taskDuties.join('\n- ')}` : null,
      `Caregiver's rough note:\n${roughNote}`
    ].filter((l): l is string => l !== null);

    const result = await askAI({
      prompt: contextLines.join('\n\n'),
      systemInstruction: DRAFT_NOTE_SYSTEM_PROMPT,
      maxOutputTokens: 300
    });

    const draft = result.text.trim();
    if (!draft) {
      // An empty model response is an upstream failure, not a usable draft.
      return res.status(502).json({ message: 'AI draft came back empty, keep your note as written.' });
    }

    const db = req.app.get('db');
    if (db) {
      try {
        await new AuditEventRepository(db).create({
          agencyId: req.auth.agencyId,
          actorId: req.auth.userId,
          actorType: 'user',
          eventType: 'evv.note.draft',
          entityType: 'evv.visit-note',
          entityId: req.auth.caregiverId,
          outcome: 'success',
          payload: {
            model: result.model,
            usageTokens: result.usageTokens,
            roughNoteHash: createHash('sha256').update(roughNote).digest('hex').slice(0, 32),
            roughNoteLength: roughNote.length,
            draftLength: draft.length,
            taskCount: taskDuties.length
          },
          occurredAt: new Date().toISOString()
        });
      } catch (error) {
        safeError('Failed to audit evv.note.draft', error);
      }
    }

    res.json({ draft, model: result.model });
  } catch (error) {
    if (error instanceof AINotConfiguredError) {
      return res.status(503).json({ message: error.message, code: 'AI_NOT_CONFIGURED' as const });
    }
    // Upstream (Bedrock) failure: 502 so the client can distinguish "try
    // again later" from a bug, and always fall back to the caregiver's own
    // wording.
    safeError('AI visit-note draft failed', error);
    res.status(502).json({ message: 'AI draft is unavailable right now, keep your note as written.' });
  }
});

export default router;
