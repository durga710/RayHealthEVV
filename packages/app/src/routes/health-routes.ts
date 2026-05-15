import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { Knex } from 'knex';
import { safeError } from '../security/safe-log.js';

/**
 * Public health endpoints powering the /status marketing page.
 *
 * Mounted BEFORE `authContext` in app.ts — these routes are intentionally
 * unauthenticated so liveness/readiness probes and the public status page
 * can hit them without a session. They get their own tighter rate limit
 * (60 / 15-min per IP) to keep an unauthenticated surface from being used
 * for DB-load DoS.
 *
 * Response shapes are deliberately minimal — never include stack traces,
 * DB connection strings, query text, or any field that could leak PHI.
 */

const STALE_THRESHOLD_SECONDS = 24 * 60 * 60; // 24 hours
const DB_QUERY_TIMEOUT_MS = 2_000;

/** Tight limit for the unauthenticated health surface — 60 req per 15-min
 *  per IP. Legitimate probes are <1/min; this stops an attacker from using
 *  the DB health probe as a free DB-load amplifier. Disabled under tests
 *  so supertest doesn't trip the limiter across cases. */
export const healthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

/** Apply no-store so probes / browsers always get a fresh reading. */
function setNoStore(res: import('express').Response): void {
  res.set('Cache-Control', 'no-store');
}

/** Race a promise against a hard timeout. Used to bound the DB SELECT 1
 *  so a hung Neon cold-start doesn't keep the response open for 15s. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}: timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

const router = Router();

/**
 * GET /health — liveness. Always 200, no DB call, <5ms.
 * Returns process uptime, timestamp, and the deployed git sha (or 'dev').
 */
router.get('/', (_req, res) => {
  setNoStore(res);
  res.status(200).json({
    status: 'ok',
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.GIT_SHA ?? 'dev',
  });
});

/**
 * GET /health/db — readiness. Runs `SELECT 1` against Postgres with a 2s
 * timeout. Returns 200 + latency on success, 503 + structured error on
 * failure or timeout. NEVER includes stack traces or connection strings.
 */
router.get('/db', async (req, res) => {
  setNoStore(res);
  const start = Date.now();
  try {
    const db = req.app.get('db') as Knex;
    await withTimeout(db.raw('select 1'), DB_QUERY_TIMEOUT_MS, 'health/db');
    res.status(200).json({
      status: 'ok',
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    safeError('health/db probe failed', err);
    res.status(503).json({
      status: 'down',
      error: 'connection failed',
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /health/audit — checks that the audit pipeline is alive by reading
 * the most recent `occurred_at` from `audit_events`.
 *  - `ok`    : last event within the last 24h.
 *  - `stale` : last event older than 24h — audit ingestion is likely stuck.
 *  - `empty` : no events at all (fresh DB or table truncated).
 *
 * Same containment as /health/db: DB failure returns 503 with a structured
 * error rather than crashing the response.
 */
router.get('/audit', async (req, res) => {
  setNoStore(res);
  try {
    const db = req.app.get('db') as Knex;
    const row = await withTimeout(
      db('audit_events').max({ lastEventAt: 'occurred_at' }).first(),
      DB_QUERY_TIMEOUT_MS,
      'health/audit',
    );
    const lastEventAtRaw =
      (row as { lastEventAt?: Date | string | null } | undefined)?.lastEventAt ?? null;
    const lastEventAt = lastEventAtRaw ? new Date(lastEventAtRaw).toISOString() : null;
    const ageSeconds =
      lastEventAt === null
        ? null
        : Math.max(0, Math.floor((Date.now() - new Date(lastEventAt).getTime()) / 1000));

    let status: 'ok' | 'stale' | 'empty';
    if (lastEventAt === null) status = 'empty';
    else if (ageSeconds !== null && ageSeconds > STALE_THRESHOLD_SECONDS) status = 'stale';
    else status = 'ok';

    res.status(200).json({
      status,
      lastEventAt,
      ageSeconds,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    safeError('health/audit probe failed', err);
    res.status(503).json({
      status: 'down',
      error: 'connection failed',
      lastEventAt: null,
      ageSeconds: null,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
