/**
 * Audit retention routes.
 *
 *   GET  /admin/audit-retention/status  — admin-only, returns counts and floor info
 *   POST /admin/audit-retention/sweep   — cron-callable sweep trigger
 *
 * The sweep endpoint is authenticated via a shared secret in the
 * Authorization header (Bearer <CRON_SECRET>) — Vercel Cron sets this
 * automatically. Falls back to admin capability check if the secret is
 * not configured, so a human admin can trigger a manual run from a
 * privileged session.
 */
import { Router } from 'express';
import { hasCapability, runAuditRetentionSweep } from '@rayhealth/core';
import { requireCapability } from '../middleware/require-capability.js';
const router = Router();
// ---------- Status ----------
router.get('/status', requireCapability('audit.read'), async (req, res) => {
    const db = req.app.get('db');
    const hotRows = (await db('audit_events')
        .count('id as total')
        .min('occurred_at as oldest_occurred_at'));
    const hotStats = hotRows[0];
    const archiveRows = (await db('audit_events_archive')
        .count('id as total')
        .min('occurred_at as oldest_occurred_at'));
    const archiveStats = archiveRows[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const last30Rows = (await db('audit_events')
        .where('occurred_at', '>=', thirtyDaysAgo)
        .count('id as count'));
    const last30Count = last30Rows[0]?.count ?? '0';
    const cutoff = new Date();
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 6);
    const approachingRows = (await db('audit_events')
        .where('occurred_at', '<', cutoff)
        .count('id as count'));
    const approachingLimitCount = approachingRows[0]?.count ?? '0';
    const lastRun = await db('audit_retention_runs')
        .orderBy('started_at', 'desc')
        .first();
    res.json({
        retentionFloorYears: 6,
        hot: {
            totalRows: Number(hotStats?.total ?? 0),
            oldestOccurredAt: hotStats?.oldest_occurred_at?.toISOString() ?? null,
            eventsLast30Days: Number(last30Count ?? 0),
            eventsApproachingSixYearLimit: Number(approachingLimitCount ?? 0),
        },
        archive: {
            totalRows: Number(archiveStats?.total ?? 0),
            oldestOccurredAt: archiveStats?.oldest_occurred_at?.toISOString() ?? null,
        },
        immutabilityTrigger: 'audit_events_block_mutation_trg',
        lastSweep: lastRun
            ? {
                id: lastRun.id,
                status: lastRun.status,
                startedAt: lastRun.started_at?.toISOString?.() ?? null,
                completedAt: lastRun.completed_at?.toISOString?.() ?? null,
                rowsArchived: lastRun.rows_archived,
                rowsPurgedFromHot: lastRun.rows_purged_from_hot,
                cutoffUsed: lastRun.cutoff_used?.toISOString?.() ?? null,
                errorMessage: lastRun.error_message ?? null,
            }
            : null,
    });
});
// ---------- Sweep trigger ----------
function assertCronAuthorized(req) {
    const secret = process.env.CRON_SECRET;
    if (!secret)
        return false;
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer '))
        return false;
    const token = header.slice('Bearer '.length).trim();
    // Constant-time compare not strictly required here (secret is per-deployment),
    // but harmless and avoids a class of timing-attack false positives.
    if (token.length !== secret.length)
        return false;
    let diff = 0;
    for (let i = 0; i < token.length; i++) {
        diff |= token.charCodeAt(i) ^ secret.charCodeAt(i);
    }
    return diff === 0;
}
router.post('/sweep', async (req, res) => {
    const cronAuthorized = assertCronAuthorized(req);
    // `auth` is attached by auth-context middleware; in the cron path the
    // middleware may not have populated it (no session/bearer), which is fine —
    // the cron secret check above is sufficient.
    const human = req.auth ? hasCapability(req.auth.role, 'audit.write') : false;
    if (!cronAuthorized && !human) {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }
    const db = req.app.get('db');
    try {
        const result = await runAuditRetentionSweep(db);
        res.json({
            ok: true,
            runId: result.runId,
            rowsArchived: result.rowsArchived,
            rowsPurgedFromHot: result.rowsPurgedFromHot,
            cutoffUsed: result.cutoffUsed.toISOString(),
            durationMs: result.durationMs,
            authorizedAs: cronAuthorized ? 'cron' : 'human',
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'unexpected error';
        // Use stderr instead of console.error per coding-style.md (no console.log).
        // App-level logger isn't wired here yet; stderr is the safest fallback.
        process.stderr.write(`audit-retention sweep failed: ${message}\n`);
        res.status(500).json({ ok: false, error: message });
    }
});
export default router;
//# sourceMappingURL=audit-retention-routes.js.map