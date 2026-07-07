import request from 'supertest';
import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import healthRoutes, { healthLimiter } from '../health-routes.js';

/**
 * The health router is the only piece under test here, we mount it on a
 * bare Express app with a hand-rolled fake `db` so we don't have to spin
 * up the full createApp() (which would re-introduce authContext and force
 * us to mint tokens for every test). The fake db mirrors the small subset
 * of the knex surface that the router actually calls:
 *   - `db.raw('select 1')`                 , for /health/db
 *   - `db('audit_events').max(...).first()`, for /health/audit
 */

interface FakeDbOpts {
  rawImpl?: (sql: string) => Promise<unknown>;
  auditMaxImpl?: () => Promise<{ lastEventAt: string | null } | undefined>;
}

function makeFakeDb(opts: FakeDbOpts = {}) {
  const tableFn = (_name: string) => ({
    max: (_cols: Record<string, string>) => ({
      first: () =>
        opts.auditMaxImpl
          ? opts.auditMaxImpl()
          : Promise.resolve({ lastEventAt: null } as const),
    }),
  });
  const db = Object.assign(tableFn, {
    raw: (sql: string) =>
      opts.rawImpl ? opts.rawImpl(sql) : Promise.resolve({ rows: [{ '?column?': 1 }] }),
  });
  return db;
}

function makeApp(db: unknown): express.Express {
  const app = express();
  app.set('db', db);
  // healthLimiter is disabled in NODE_ENV=test, but we mount it here anyway
  // to keep parity with how app.ts wires the router.
  app.use('/health', healthLimiter, healthRoutes);
  return app;
}

describe('GET /health', () => {
  it('returns 200 with status ok, uptimeSeconds, timestamp, and version', async () => {
    const app = makeApp(makeFakeDb());

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', version: expect.any(String) });
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(res.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(typeof res.body.timestamp).toBe('string');
    // ISO 8601 sanity check
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
    expect(res.headers['cache-control']).toContain('no-store');
  });
});

describe('GET /health/db', () => {
  it('returns ok shape with latencyMs when SELECT 1 succeeds', async () => {
    const rawImpl = vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
    const app = makeApp(makeFakeDb({ rawImpl }));

    const res = await request(app).get('/health/db');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.latencyMs).toBe('number');
    expect(res.body.latencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof res.body.timestamp).toBe('string');
    expect(rawImpl).toHaveBeenCalledWith('select 1');
    expect(res.headers['cache-control']).toContain('no-store');
  });

  it('returns 503 down shape with generic error when the DB throws', async () => {
    const rawImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    const app = makeApp(makeFakeDb({ rawImpl }));

    const res = await request(app).get('/health/db');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'down', error: 'connection failed' });
    expect(typeof res.body.latencyMs).toBe('number');
    // CRITICAL: never leak the raw DB error message / stack to the client.
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
    expect(JSON.stringify(res.body)).not.toContain('5432');
  });
});

describe('GET /health/audit', () => {
  it('returns status="ok" when last event is within the last 24h', async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const app = makeApp(
      makeFakeDb({ auditMaxImpl: () => Promise.resolve({ lastEventAt: oneHourAgo }) }),
    );

    const res = await request(app).get('/health/audit');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.lastEventAt).toBe(oneHourAgo);
    expect(typeof res.body.ageSeconds).toBe('number');
    expect(res.body.ageSeconds).toBeGreaterThanOrEqual(60 * 60 - 5);
  });

  it('returns status="stale" when last event is older than 24h', async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const app = makeApp(
      makeFakeDb({ auditMaxImpl: () => Promise.resolve({ lastEventAt: twoDaysAgo }) }),
    );

    const res = await request(app).get('/health/audit');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('stale');
    expect(res.body.lastEventAt).toBe(twoDaysAgo);
    expect(res.body.ageSeconds).toBeGreaterThan(24 * 60 * 60);
  });

  it('returns status="empty" when audit_events has no rows', async () => {
    const app = makeApp(
      makeFakeDb({ auditMaxImpl: () => Promise.resolve({ lastEventAt: null }) }),
    );

    const res = await request(app).get('/health/audit');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('empty');
    expect(res.body.lastEventAt).toBeNull();
    expect(res.body.ageSeconds).toBeNull();
  });

  it('returns 503 with structured error when the audit query throws', async () => {
    const app = makeApp(
      makeFakeDb({
        auditMaxImpl: () => Promise.reject(new Error('relation "audit_events" does not exist')),
      }),
    );

    const res = await request(app).get('/health/audit');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'down', error: 'connection failed' });
  });
});
