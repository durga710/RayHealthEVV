/**
 * Agency HHAeXchange config routes.
 *
 *   GET  /agencies/me/hhaexchange-config  — read the agency's HHAeXchange identity
 *                                            + mappings (returns nullable identity
 *                                            fields when the agency is mid-onboarding)
 *   PUT  /agencies/me/hhaexchange-config  — admin-only update
 *
 * The PUT validates against the existing
 * `hhaexchangeCaregiverMappingSchema` / `hhaexchangeServiceMappingSchema`
 * Zod schemas so caregivers/services that the agency has never mapped get
 * rejected cleanly — the EVV export pipeline can then trust that a stored
 * config has well-formed mappings.
 */
import { Router } from 'express';
import { z } from 'zod';
import { AgencyHhaexchangeConfigRepository, AuditEventRepository, hhaexchangeCaregiverMappingSchema, hhaexchangeServiceMappingSchema, isSafeOutboundUrl, } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
const router = Router();
// https + public-host only — same SSRF guard as the Sandata config route.
const safeAggregatorUrl = z
    .string()
    .max(255)
    .refine(isSafeOutboundUrl, { message: 'apiBaseUrl must be an https URL to a public host' });
// ---------- Update payload schema ----------
const hhaexchangeConfigUpdateSchema = z.object({
    agencyTaxId: z
        .string()
        .regex(/^\d{9}$/, 'HHAeXchange agency tax ID is 9 digits, no dash')
        .nullable()
        .optional(),
    hhaProviderId: z.string().min(1).max(32).nullable().optional(),
    timezone: z.string().min(1).max(64).optional(),
    caregivers: z.array(hhaexchangeCaregiverMappingSchema).optional(),
    services: z.array(hhaexchangeServiceMappingSchema).optional(),
    enabled: z.boolean().optional(),
    apiBaseUrl: safeAggregatorUrl.nullable().optional(),
    // Write-only. undefined = leave unchanged; null = clear; object = encrypt+store.
    credentials: z
        .object({
        username: z.string().max(255).optional(),
        password: z.string().max(255).optional(),
        apiKey: z.string().max(512).optional(),
        account: z.string().max(255).optional(),
    })
        .strict()
        .nullable()
        .optional(),
});
// ---------- Helpers ----------
function emptyPartialFor(agencyId) {
    return {
        agencyId,
        agencyTaxId: null,
        hhaProviderId: null,
        timezone: 'America/New_York',
        caregivers: [],
        services: [],
        enabled: false,
        apiBaseUrl: null,
        hasCredentials: false,
    };
}
function mergeConfig(current, update) {
    return {
        agencyId: current.agencyId,
        agencyTaxId: update.agencyTaxId !== undefined ? update.agencyTaxId : current.agencyTaxId,
        hhaProviderId: update.hhaProviderId !== undefined ? update.hhaProviderId : current.hhaProviderId,
        timezone: update.timezone ?? current.timezone,
        caregivers: update.caregivers ?? current.caregivers,
        services: update.services ?? current.services,
        enabled: update.enabled ?? current.enabled,
        apiBaseUrl: update.apiBaseUrl !== undefined ? update.apiBaseUrl : current.apiBaseUrl,
        hasCredentials: current.hasCredentials,
    };
}
/** Refuse to set `enabled=true` until both identity fields are populated.
 *  Returns an error string when the proposed config is incoherent, otherwise
 *  null. */
function validateForEnable(next) {
    if (!next.enabled)
        return null;
    if (!next.agencyTaxId) {
        return 'cannot enable: agencyTaxId is required';
    }
    if (!next.hhaProviderId) {
        return 'cannot enable: hhaProviderId is required';
    }
    return null;
}
// ---------- GET ----------
router.get('/me/hhaexchange-config', requireCapability('agency.read'), async (req, res) => {
    try {
        const db = req.app.get('db');
        if (!db) {
            res.status(500).json({ success: false, error: 'database missing' });
            return;
        }
        const repo = new AgencyHhaexchangeConfigRepository(db);
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
router.put('/me/hhaexchange-config', requireCapability('agency.write'), async (req, res) => {
    try {
        const parsed = hhaexchangeConfigUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                success: false,
                error: 'hhaexchange-config payload failed validation',
                details: parsed.error.issues,
            });
            return;
        }
        const db = req.app.get('db');
        if (!db) {
            res.status(500).json({ success: false, error: 'database missing' });
            return;
        }
        const repo = new AgencyHhaexchangeConfigRepository(db);
        const previous = (await repo.findByAgency(req.auth.agencyId)) ?? emptyPartialFor(req.auth.agencyId);
        const next = mergeConfig(previous, parsed.data);
        const guardError = validateForEnable(next);
        if (guardError) {
            res.status(422).json({ success: false, error: guardError });
            return;
        }
        const stored = await repo.upsert({ ...next, credentials: parsed.data.credentials });
        try {
            await new AuditEventRepository(db).create({
                agencyId: req.auth.agencyId,
                actorId: req.auth.userId,
                actorType: 'user',
                eventType: 'agency.evv-config.changed',
                entityType: 'agency_hhaexchange_config',
                entityId: req.auth.agencyId,
                outcome: 'success',
                payload: {
                    aggregator: 'hhaexchange',
                    previous: redactForAudit(previous),
                    next: redactForAudit(stored),
                },
            });
        }
        catch (auditErr) {
            process.stderr.write(`[audit-write-failed] agency.evv-config.changed (hhaexchange) agency=${req.auth.agencyId} ` +
                `err=${auditErr instanceof Error ? auditErr.message : 'unknown'}\n`);
        }
        res.json({ success: true, data: stored });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error';
        res.status(500).json({ success: false, error: message });
    }
});
/** Mappings can grow long; keep the audit payload compact by summarizing
 *  counts plus a hash of the identity fields rather than dumping every row. */
function redactForAudit(c) {
    return {
        agencyTaxIdSet: Boolean(c.agencyTaxId),
        hhaProviderIdSet: Boolean(c.hhaProviderId),
        timezone: c.timezone,
        enabled: c.enabled,
        caregiverMappingCount: c.caregivers.length,
        serviceMappingCount: c.services.length,
        apiBaseUrlSet: Boolean(c.apiBaseUrl),
        hasCredentials: c.hasCredentials,
    };
}
export default router;
//# sourceMappingURL=agency-hhaexchange-config-routes.js.map