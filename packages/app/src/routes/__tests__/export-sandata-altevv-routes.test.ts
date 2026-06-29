import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

// Route-level gating for the real Sandata Alternate-EVV endpoints. The async
// transport itself (sequencing, load-order deferral, poll) is covered by the
// core unit tests (sandata-transmission-service / sandata-alt-evv-api); these
// tests verify config gating, auth, and validation — the route's own logic,
// which never reaches the DB-backed state repository.

function mockConfig(value: unknown) {
  vi.spyOn(core, 'AgencySandataConfigRepository').mockImplementation(() => ({
    findSubmissionConfig: vi.fn().mockResolvedValue(value),
  } as any));
}

describe('Sandata Alternate-EVV routes — submit gating', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns not_configured (409) when no Sandata config exists', async () => {
    mockConfig(undefined);
    const res = await request(createApp())
      .post('/exports/sandata/altevv/submit')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ from: '2026-06-01', to: '2026-06-30' });
    expect(res.status).toBe(409);
    expect(res.body.status).toBe('not_configured');
  });

  it('returns not_configured (409) when the integration is disabled', async () => {
    mockConfig({ enabled: false, apiBaseUrl: 'https://uat.sandata.example/v1', credentials: { username: 'u', password: 'p' } });
    const res = await request(createApp())
      .post('/exports/sandata/altevv/submit')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.reason).toMatch(/disabled/i);
  });

  it('returns not_configured (409) when credentials lack a username/password', async () => {
    mockConfig({ enabled: true, apiBaseUrl: 'https://uat.sandata.example/v1', credentials: { apiKey: 'k' } });
    const res = await request(createApp())
      .post('/exports/sandata/altevv/submit')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.reason).toMatch(/username and password/i);
  });

  it('rejects a malformed date with 400', async () => {
    const res = await request(createApp())
      .post('/exports/sandata/altevv/submit')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({ from: 'not-a-date' });
    expect(res.status).toBe(400);
  });

  it('forbids coordinators (no billing.write) from submitting', async () => {
    const res = await request(createApp())
      .post('/exports/sandata/altevv/submit')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({});
    expect(res.status).toBe(403);
  });
});

describe('Sandata Alternate-EVV routes — poll gating', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns not_configured (409) when Sandata is unset', async () => {
    mockConfig(undefined);
    const res = await request(createApp())
      .post('/exports/sandata/altevv/poll')
      .set('Authorization', `Bearer ${makeToken('admin')}`)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.status).toBe('not_configured');
  });

  it('forbids coordinators from polling', async () => {
    const res = await request(createApp())
      .post('/exports/sandata/altevv/poll')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({});
    expect(res.status).toBe(403);
  });
});
