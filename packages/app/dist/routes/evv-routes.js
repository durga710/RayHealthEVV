import { Router } from 'express';
import { requireCapability } from '../middleware/require-capability.js';
import { AuditEventRepository, ClientRepository, EvvExceptionRepository, EvvRepository, ScheduleRepository, checkGeofence, detectVisitExceptions, evvClockInInputSchema, evvClockOutInputSchema, evvServiceCodeSchema, evvVisitIdSchema } from '@rayhealth/core';
import { safeError } from '../security/safe-log.js';
const router = Router();
/**
 * Build the friendly 422 envelope for a geofence violation. Distance is
 * already rounded by `checkGeofence`. Message is human-readable so the
 * mobile app can surface it directly without composing copy client-side.
 */
function geofenceRejection(envelope) {
    return {
        message: `You are ${envelope.distanceM} m from the client's address — please move closer to clock in.`,
        code: 'GEOFENCE_OUT_OF_BOUNDS',
        distanceM: envelope.distanceM,
        allowedM: envelope.allowedM
    };
}
router.get('/visits', requireCapability('evv.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new EvvRepository(db);
        // Caregivers see only their own visits. Admin / coordinator / family
        // get the agency scope. Tenant isolation is enforced inside the repo
        // via JOIN on users.agency_id.
        const visits = req.auth.role === 'caregiver' && req.auth.caregiverId
            ? await repo.getVisitsForCaregiver(req.auth.caregiverId)
            : await repo.getVisitsForAgency(req.auth.agencyId);
        res.json(visits);
    }
    catch {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
/**
 * Lightweight count for dashboard tiles — a SQL COUNT instead of shipping every
 * (PHI-bearing) visit row to the client just to read its length.
 */
router.get('/visits/count', requireCapability('evv.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        const repo = new EvvRepository(db);
        const count = req.auth.role === 'caregiver' && req.auth.caregiverId
            ? (await repo.getVisitsForCaregiver(req.auth.caregiverId)).length
            : await repo.countVisitsForAgency(req.auth.agencyId);
        res.json({ count });
    }
    catch {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.post('/clock-in', requireCapability('evv.write'), async (req, res) => {
    try {
        if (!req.auth.caregiverId)
            return res.status(403).json({ message: 'User is not authorized as a caregiver' });
        const parsed = evvClockInInputSchema.safeParse(req.body ?? {});
        if (!parsed.success)
            return res.status(400).json({ message: 'Valid assignmentId and GPS location are required' });
        const db = req.app.get('db');
        const repo = new EvvRepository(db);
        const scheduleRepo = new ScheduleRepository(db);
        // Resolve client_id (Cures-Act #2 — beneficiary) from the assignment's
        // visit_template. Snapshotting it onto the visit row keeps the row
        // self-contained for aggregator submission and audit.
        const assignment = await scheduleRepo.getAssignmentForCaregiver(parsed.data.assignmentId, req.auth.caregiverId, req.auth.agencyId);
        if (!assignment)
            return res.status(404).json({ message: 'Assignment not found' });
        // Geofence gate. Pulls the client's anchor + radius (tenant-scoped) and
        // compares against the GPS lat/lng captured by the mobile app. Fails
        // open when the client has no registered coordinates — see
        // checkGeofence() docstring for the rationale.
        const clientRepo = new ClientRepository(db);
        const clientGeofence = await clientRepo.getClientGeofence(assignment.clientId, req.auth.agencyId);
        if (clientGeofence) {
            const violation = checkGeofence(parsed.data.location, clientGeofence);
            if (violation) {
                // Audit out-of-bounds attempts so the policy gap is observable —
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
                }
                catch (err) {
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
        if (authorizedServiceCode?.success &&
            parsed.data.serviceCode &&
            authorizedServiceCode.data !== parsed.data.serviceCode) {
            return res.status(400).json({ message: 'serviceCode does not match the client authorization' });
        }
        const serviceCode = authorizedServiceCode?.success ? authorizedServiceCode.data : parsed.data.serviceCode;
        if (!serviceCode) {
            // Cures-Act #1 — service code is mandatory at clock-in. Refuse rather
            // than silently NULLing it; downstream aggregator submission will reject
            // a visit row without a service code anyway.
            return res.status(400).json({ message: 'serviceCode (HCPCS) is required at clock-in' });
        }
        const visit = await repo.createVisit({
            assignmentId: parsed.data.assignmentId,
            caregiverId: req.auth.caregiverId,
            clientId: assignment.clientId,
            serviceCode,
            clockInTime: new Date().toISOString(),
            clockInLocation: parsed.data.location,
            status: 'pending'
        });
        res.status(201).json(visit);
    }
    catch {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.post('/clock-out/:id', requireCapability('evv.write'), async (req, res) => {
    try {
        if (!req.auth.caregiverId)
            return res.status(403).json({ message: 'User is not authorized as a caregiver' });
        const rawId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
        const id = evvVisitIdSchema.safeParse(rawId);
        const parsed = evvClockOutInputSchema.safeParse(req.body ?? {});
        if (!id.success || !parsed.success) {
            return res.status(400).json({ message: 'Valid visit id and GPS location are required' });
        }
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
        // value — silently discarding the original clock-out and, if any
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
            const clientGeofence = await clientRepo.getClientGeofence(existing.clientId, req.auth.agencyId);
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
                    }
                    catch (err) {
                        safeError('Failed to record geofence audit event', err);
                    }
                    return res.status(422).json(geofenceRejection(violation));
                }
            }
        }
        const clockOutTime = new Date().toISOString();
        // Best-effort scheduled-start lookup for late-clock-in detection.
        let scheduledStartTime = null;
        try {
            const assignmentRow = await db('assignments')
                .where({ id: existing.assignmentId })
                .first('scheduled_start_time');
            const raw = assignmentRow?.scheduled_start_time;
            scheduledStartTime = raw ? new Date(raw).toISOString() : null;
        }
        catch (err) {
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
        // not exist. Both surface as 404 — we never confirm cross-tenant existence.
        const visit = await repo.updateVisit(id.data, req.auth.agencyId, {
            clockOutTime,
            clockOutLocation: parsed.data.location,
            status
        });
        if (!visit)
            return res.status(404).json({ message: 'Visit not found' });
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
            }
            catch (err) {
                safeError('Failed to persist EVV exceptions', err);
            }
        }
        res.json(visit);
    }
    catch {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
export default router;
//# sourceMappingURL=evv-routes.js.map