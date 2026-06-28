/**
 * Recurring schedule routes.
 *
 *   GET    /recurring-schedules              — list patterns (with names)
 *   POST   /recurring-schedules              — create a weekly pattern
 *   PATCH  /recurring-schedules/:id/status   — active | paused | ended
 *   DELETE /recurring-schedules/:id          — delete a pattern
 *   POST   /recurring-schedules/:id/materialize  — generate assignments (one)
 *   POST   /recurring-schedules/materialize      — generate for all active
 *
 * Materialization expands a pattern into concrete `assignments` over a rolling
 * horizon (default 14 days, max 90), idempotently — re-running never
 * double-books a date. Reads use schedule.read; every mutation uses
 * schedule.write (admin + coordinator; caregivers excluded).
 */
import { Router } from 'express';
import { z } from 'zod';
import { AuditEventRepository, CaregiverRepository, RecurringScheduleRepository, ScheduleRepository, recurringScheduleSchema, recurringScheduleStatuses, } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
import { safeError } from '../security/safe-log.js';
const router = Router();
const statusSchema = z.object({ status: z.enum(recurringScheduleStatuses) });
const materializeSchema = z.object({ days: z.number().int().min(1).max(90).optional() });
const ymd = (d) => d.toISOString().slice(0, 10);
function horizonWindow(days) {
    const horizon = Math.min(Math.max(days ?? 14, 1), 90);
    return { start: ymd(new Date()), end: ymd(new Date(Date.now() + horizon * 86400000)) };
}
router.get('/', requireCapability('schedule.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        res.json(await new RecurringScheduleRepository(db).list(req.auth.agencyId));
    }
    catch (err) {
        safeError('list recurring schedules failed', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.post('/', requireCapability('schedule.write'), async (req, res) => {
    const parsed = recurringScheduleSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: 'Invalid recurring schedule',
            issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
        return;
    }
    try {
        const db = req.app.get('db');
        const agencyId = req.auth.agencyId;
        const caregiver = await new CaregiverRepository(db).findById(parsed.data.caregiverId, agencyId);
        if (!caregiver) {
            res.status(404).json({ message: 'caregiver not found in this agency' });
            return;
        }
        const templateClient = await new ScheduleRepository(db).getTemplateClient(parsed.data.visitTemplateId, agencyId);
        if (!templateClient) {
            res.status(404).json({ message: 'visit template not found in this agency' });
            return;
        }
        const { id } = await new RecurringScheduleRepository(db).create(agencyId, parsed.data);
        res.status(201).json({ id });
    }
    catch (err) {
        safeError('create recurring schedule failed', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.patch('/:id/status', requireCapability('schedule.write'), async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: `status must be one of: ${recurringScheduleStatuses.join(', ')}` });
        return;
    }
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    try {
        const db = req.app.get('db');
        const ok = await new RecurringScheduleRepository(db).setStatus(req.auth.agencyId, id, parsed.data.status);
        if (!ok) {
            res.status(404).json({ message: 'recurring schedule not found' });
            return;
        }
        res.json({ id, status: parsed.data.status });
    }
    catch (err) {
        safeError('update recurring schedule status failed', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.delete('/:id', requireCapability('schedule.write'), async (req, res) => {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    try {
        const db = req.app.get('db');
        const ok = await new RecurringScheduleRepository(db).remove(req.auth.agencyId, id);
        if (!ok) {
            res.status(404).json({ message: 'recurring schedule not found' });
            return;
        }
        res.status(204).end();
    }
    catch (err) {
        safeError('delete recurring schedule failed', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
async function auditMaterialize(db, req, payload) {
    try {
        await new AuditEventRepository(db).create({
            agencyId: req.auth.agencyId,
            actorId: req.auth.userId,
            actorType: 'user',
            eventType: 'schedule.recurring.materialized',
            entityType: 'recurring_schedule',
            entityId: req.auth.agencyId,
            outcome: 'success',
            payload,
            occurredAt: new Date().toISOString(),
        });
    }
    catch (err) {
        safeError('Failed to audit schedule.recurring.materialized', err);
    }
}
router.post('/:id/materialize', requireCapability('schedule.write'), async (req, res) => {
    const parsed = materializeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        res.status(400).json({ message: 'days must be an integer 1–90' });
        return;
    }
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const { start, end } = horizonWindow(parsed.data.days);
    try {
        const db = req.app.get('db');
        const result = await new RecurringScheduleRepository(db).materialize(req.auth.agencyId, id, start, end);
        await auditMaterialize(db, req, { ...result, windowStart: start, windowEnd: end });
        res.json({ ...result, windowStart: start, windowEnd: end });
    }
    catch (err) {
        safeError('materialize recurring schedule failed', err);
        const message = err instanceof Error ? err.message : 'Internal Server Error';
        res.status(message.includes('not found') ? 404 : 500).json({ message });
    }
});
router.post('/materialize', requireCapability('schedule.write'), async (req, res) => {
    const parsed = materializeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        res.status(400).json({ message: 'days must be an integer 1–90' });
        return;
    }
    const { start, end } = horizonWindow(parsed.data.days);
    try {
        const db = req.app.get('db');
        const results = await new RecurringScheduleRepository(db).materializeAllActive(req.auth.agencyId, start, end);
        const created = results.reduce((s, r) => s + r.created, 0);
        const skipped = results.reduce((s, r) => s + r.skipped, 0);
        await auditMaterialize(db, req, {
            schedules: results.length,
            created,
            skipped,
            windowStart: start,
            windowEnd: end,
        });
        res.json({ schedules: results.length, created, skipped, windowStart: start, windowEnd: end });
    }
    catch (err) {
        safeError('materialize all recurring schedules failed', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
export default router;
//# sourceMappingURL=recurring-schedule-routes.js.map