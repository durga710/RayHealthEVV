import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

const CRON_SECRET = 'cron-test-secret-value';

const sandboxConfig = {
  enabled: true,
  transport: 'sandbox',
  endpoint: null,
  credentials: null,
  settings: {},
};

const submittedClaims = {
  rows: [
    {
      id: 'claim-1',
      controlNumber: 'ABC111111111',
      totalChargeCents: 5000,
      status: 'submitted',
    },
    {
      id: 'claim-2',
      controlNumber: 'DEF222222223', // ends in 3: sandbox denies it
      totalChargeCents: 3000,
      status: 'submitted',
    },
  ],
  total: 2,
};

function installMocks(options: { alreadyIngested?: boolean } = {}) {
  const postEra = vi.fn().mockResolvedValue({ posted: 2, matched: 2, unmatched: [] });
  vi.spyOn(core, 'ClaimRepository').mockImplementation(
    () =>
      ({
        listClaims: vi.fn().mockResolvedValue(submittedClaims),
        postEra,
      }) as unknown as core.ClaimRepository,
  );

  vi.spyOn(core, 'AgencyClearinghouseConfigRepository').mockImplementation(
    () =>
      ({
        findSubmissionConfig: vi.fn().mockResolvedValue(sandboxConfig),
        listEnabledAgencyIds: vi.fn().mockResolvedValue(['agency-cron-1']),
      }) as unknown as core.AgencyClearinghouseConfigRepository,
  );

  const hasIngested = vi.fn().mockResolvedValue(options.alreadyIngested ?? false);
  const record = vi.fn().mockResolvedValue(undefined);
  const list = vi.fn().mockResolvedValue([]);
  vi.spyOn(core, 'ClearinghouseRemittanceFileRepository').mockImplementation(
    () => ({ hasIngested, record, list }) as unknown as core.ClearinghouseRemittanceFileRepository,
  );

  vi.spyOn(core, 'AuditEventRepository').mockImplementation(
    () => ({ create: vi.fn().mockResolvedValue({}) }) as unknown as core.AuditEventRepository,
  );

  return { postEra, hasIngested, record };
}

describe('remittance sweep routes', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
  });
  afterEach(() => {
    delete process.env.CRON_SECRET;
    vi.restoreAllMocks();
  });

  it('rejects an unauthenticated call with no cron secret', async () => {
    installMocks();
    const res = await request(createApp()).get('/billing/remittances/sweep');
    expect(res.status).toBe(401);
  });

  it('rejects a wrong cron secret', async () => {
    installMocks();
    const res = await request(createApp())
      .get('/billing/remittances/sweep')
      .set('Authorization', 'Bearer wrong-secret-of-same-nature');
    expect(res.status).toBe(401);
  });

  it('runs the sweep for all enabled agencies on a cron GET and posts the sandbox 835', async () => {
    const { postEra, record } = installMocks();
    const res = await request(createApp())
      .get('/billing/remittances/sweep')
      .set('Authorization', `Bearer ${CRON_SECRET}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      agenciesProcessed: 1,
      filesIngested: 1,
      filesSkipped: 0,
      claimsMatched: 2,
      timedOut: false,
    });
    expect(postEra).toHaveBeenCalledTimes(1);
    const era = postEra.mock.calls[0][1];
    expect(era.claims).toHaveLength(2);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ agencyId: 'agency-cron-1', transport: 'sandbox', claimCount: 2, matchedCount: 2 }),
    );
  });

  it('skips files already in the ledger without posting again', async () => {
    const { postEra } = installMocks({ alreadyIngested: true });
    const res = await request(createApp())
      .get('/billing/remittances/sweep')
      .set('Authorization', `Bearer ${CRON_SECRET}`);
    expect(res.status).toBe(200);
    expect(res.body.filesIngested).toBe(0);
    expect(res.body.filesSkipped).toBe(1);
    expect(postEra).not.toHaveBeenCalled();
  });

  it('lets a billing.write session sweep only its own agency via POST', async () => {
    delete process.env.CRON_SECRET;
    installMocks();
    const res = await request(createApp())
      .post('/billing/remittances/sweep')
      .set('Authorization', `Bearer ${makeToken('admin')}`);
    expect(res.status).toBe(200);
    expect(res.body.agenciesProcessed).toBe(1);
  });

  it('forbids a caregiver session from sweeping', async () => {
    delete process.env.CRON_SECRET;
    installMocks();
    const res = await request(createApp())
      .post('/billing/remittances/sweep')
      .set('Authorization', `Bearer ${makeToken('caregiver')}`);
    expect(res.status).toBe(401);
  });

  it('serves the ledger to billing.read sessions', async () => {
    installMocks();
    const res = await request(createApp())
      .get('/billing/remittances/files')
      .set('Authorization', `Bearer ${makeToken('admin')}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
