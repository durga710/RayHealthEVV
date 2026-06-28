import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as core from '@rayhealth/core';
import { createApp } from '../../app.js';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /admin/audit-retention/status', () => {
  it('returns retention stats + statutory floor for admins with audit.read', async () => {
    const agencyId = '00000000-0000-4000-8000-000000000091';
    const userId = '00000000-0000-4000-8000-000000000092';

    const fakeDb = Object.assign(
      (table: string) => {
        const query: any = {
          count: (col: string) => {
            query.isCount = true;
            return query;
          },
          min: (col: string) => {
            if (table === 'audit_events') {
              return Promise.resolve([{ total: '12345', oldest_occurred_at: new Date('2024-01-15T00:00:00.000Z') }]);
            } else if (table === 'audit_events_archive') {
              return Promise.resolve([{ total: '0', oldest_occurred_at: null }]);
            }
            return Promise.resolve([]);
          },
          where: (col: string, op: string, val: any) => {
            query.whereVal = val;
            return query;
          },
          orderBy: (col: string, dir: string) => {
            return query;
          },
          first: () => {
            if (table === 'audit_retention_runs') {
              return Promise.resolve({
                id: 'run-id',
                status: 'success',
                started_at: new Date('2026-05-22T08:00:00.000Z'),
                completed_at: new Date('2026-05-22T08:01:00.000Z'),
                rows_archived: 50,
                rows_purged_from_hot: 50,
                cutoff_used: new Date('2020-05-22T00:00:00.000Z'),
                error_message: null
              });
            }
            return Promise.resolve(null);
          },
          then: (resolve: any) => {
            if (query.isCount) {
              if (query.whereVal && query.whereVal instanceof Date && query.whereVal.getFullYear() < new Date().getFullYear() - 5) {
                return resolve([{ count: '0' }]);
              }
              return resolve([{ count: '3402' }]);
            }
            return resolve([]);
          }
        };
        return query;
      },
      {}
    );

    const app = createApp();
    app.set('db', fakeDb);

    const response = await request(app)
      .get('/admin/audit-retention/status')
      .set('Authorization', `Bearer ${makeToken('admin', agencyId, userId)}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      retentionFloorYears: 7,
      hot: {
        totalRows: 12_345,
        oldestOccurredAt: '2024-01-15T00:00:00.000Z',
        eventsLast30Days: 3_402,
        eventsApproachingRetentionLimit: 0,
      },
      archive: {
        totalRows: 0,
        oldestOccurredAt: null,
      },
      immutabilityTrigger: 'audit_events_block_mutation_trg',
      lastSweep: {
        id: 'run-id',
        status: 'success',
        startedAt: '2026-05-22T08:00:00.000Z',
        completedAt: '2026-05-22T08:01:00.000Z',
        rowsArchived: 50,
        rowsPurgedFromHot: 50,
        cutoffUsed: '2020-05-22T00:00:00.000Z',
        errorMessage: null,
      }
    });
  });

  it('rejects coordinators (no audit.read capability)', async () => {
    const agencyId = '00000000-0000-4000-8000-000000000093';
    const userId = '00000000-0000-4000-8000-000000000094';

    const response = await request(createApp())
      .get('/admin/audit-retention/status')
      .set('Authorization', `Bearer ${makeToken('coordinator', agencyId, userId)}`);

    expect(response.status).toBe(403);
  });

  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(createApp()).get('/admin/audit-retention/status');
    expect(response.status).toBe(401);
  });
});
