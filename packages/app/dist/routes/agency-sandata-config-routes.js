/**
 * Agency Sandata config routes.
 *
 *   GET  /agencies/me/sandata-config   — read identity + mappings (nullable identity allowed)
 *   PUT  /agencies/me/sandata-config   — admin-only update
 *
 * Sibling to `agency-hhaexchange-config-routes.ts`. Validates the per-mapping
 * shapes with the existing Zod schemas from `services/sandata-mapping.ts`
 * (caregivers are UUID + external worker ID; services are HCPCS code +
 * modifier + label). Refuses `enabled=true` until provider_id is populated.
 */
import { Router } from 'express';
import { z } from 'zod';
import { AgencySandataConfigRepository, AuditEventRepository, sandataCaregiverMappingSchema, sandataServiceMappingSchema, } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
const router = Router();
const sandataConfigUpdateSchema = z.object({
    providerId: z
        .string()
        .regex(/^\d{9}$/, 'Sandata Provider ID is 9 digits')
        .nullable()
        .optional(),
    timezone: z.string().min(1).max(64).optional(),
    caregivers: z.array(sandataCaregiverMappingSchema).optional(),
    services: z.array(sandataServiceMappingSchema).optional(),
    enabled: z.boolean().optional(),
});
function emptyPartialFor(agencyId) {
    return {
        agencyId,
        providerId: null,
        timezone: 'America/New_York',
        caregivers: [],
        services: [],
        enabled: false,
    };
}
function mergeConfig(current, update) {
    return {
        agencyId: current.agencyId,
        providerId: update.providerId !== undefined ? update.providerId : current.providerId,
        timezone: update.timezone ?? current.timezone,
        caregivers: update.caregivers ?? current.caregivers,
        services: update.services ?? current.services,
        enabled: update.enabled ?? current.enabled,
    };
}
function validateForEnable(next) {
    if (!next.enabled)
        return null;
    if (!next.providerId) {
        return 'cannot enable: providerId is required';
    }
    return null;
}
function redactForAudit(c) {
    return {
        providerIdSet: Boolean(c.providerId),
        timezone: c.timezone,
        enabled: c.enabled,
        caregiverMappingCount: c.caregivers.length,
        serviceMappingCount: c.services.length,
    };
}
// ---------- GET ----------
router.get('/me/sandata-config', requireCapability('agency.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        if (!db) {
            res.status(500).json({ success: false, error: 'database missing' });
            return;
        }
        const repo = new AgencySandataConfigRepository(db);
        const stored = await repo.findByAgency(req.auth.agencyId);
        const data = stored ?? emptyPartialFor(req.auth.agencyId);
        res.json({ success: true, data });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error';
        res.status(500).json({ success: false, error: message });
    }
});
// ---------- PUT ----------
router.put('/me/sandata-config', requireCapability('agency.write'), async (req, res) => {
    try {
        const parsed = sandataConfigUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                success: false,
                error: 'sandata-config payload failed validation',
                details: parsed.error.issues,
            });
            return;
        }
        const db = req.app.get('db');
        if (!db) {
            res.status(500).json({ success: false, error: 'database missing' });
            return;
        }
        const repo = new AgencySandataConfigRepository(db);
        const previous = (await repo.findByAgency(req.auth.agencyId)) ?? emptyPartialFor(req.auth.agencyId);
        const next = mergeConfig(previous, parsed.data);
        const guardError = validateForEnable(next);
        if (guardError) {
            res.status(422).json({ success: false, error: guardError });
            return;
        }
        const stored = await repo.upsert(next);
        try {
            await new AuditEventRepository(db).create({
                agencyId: req.auth.agencyId,
                actorId: req.auth.userId,
                actorType: 'user',
                eventType: 'agency.evv-config.changed',
                entityType: 'agency_sandata_config',
                entityId: req.auth.agencyId,
                outcome: 'success',
                payload: {
                    aggregator: 'sandata',
                    previous: redactForAudit(previous),
                    next: redactForAudit(stored),
                },
            });
        }
        catch (auditErr) {
            process.stderr.write(`[audit-write-failed] agency.evv-config.changed (sandata) agency=${req.auth.agencyId} ` +
                `err=${auditErr instanceof Error ? auditErr.message : 'unknown'}\n`);
        }
        res.json({ success: true, data: stored });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error';
        res.status(500).json({ success: false, error: message });
    }
});
export default router;
//# sourceMappingURL=agency-sandata-config-routes.js.map