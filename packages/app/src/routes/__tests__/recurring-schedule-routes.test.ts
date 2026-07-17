import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import * as core from '@rayhealth/core';
import { makeToken, setTestJwtSecret } from './test-helpers.js';

beforeAll(() => setTestJwtSecret());

const validBody = {
  caregiverId: 'caregiver-1',
  visitTemplateId: 'template-1',
  daysOfWeek: [1, 3, 5],
  startTime: '09:00',
  endTime: '13:00',
  startDate: '2026-07-01',
  endDate: '2026-12-31',
};

describe('recurring schedule routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists recurring schedules for coordinators', async () => {
    const list = vi.fn().mockResolvedValue([{ id: 'rs-1', status: 'active' }]);
    vi.spyOn(core, 'RecurringScheduleRepository').mockImplementation(() => ({ list } as any));

    const res = await request(createApp())
      .get('/recurring-schedules')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(list).toHaveBeenCalled();
  });

  it('returns the coverage forecast (ungenerated upcoming visits)', async () => {
    const forecastCoverage = vi.fn().mockResolvedValue({
      windowStart: '2026-06-28',
      windowEnd: '2026-07-12',
      totalGaps: 2,
      gaps: [
        { scheduleId: 'rs-1', caregiverName: 'Care One', clientName: 'Client A', templateName: 'Morning', date: '2026-06-29', startTime: '09:00', endTime: '13:00' },
        { scheduleId: 'rs-1', caregiverName: 'Care One', clientName: 'Client A', templateName: 'Morning', date: '2026-06-30', startTime: '09:00', endTime: '13:00' },
      ],
    });
    vi.spyOn(core, 'RecurringScheduleRepository').mockImplementation(() => ({ forecastCoverage } as any));

    const res = await request(createApp())
      .get('/recurring-schedules/forecast?days=14')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`);

    expect(res.status).toBe(200);
    expect(res.body.totalGaps).toBe(2);
    expect(res.body.gaps).toHaveLength(2);
    expect(forecastCoverage).toHaveBeenCalled();
  });

  it('forbids caregivers from reading the coverage forecast', async () => {
    const res = await request(createApp())
      .get('/recurring-schedules/forecast')
      .set('Authorization', `Bearer ${makeToken('caregiver', 'agency-1', 'user-1', 'caregiver-1')}`);
    expect(res.status).toBe(403);
  });

  it('creates a recurring schedule when caregiver and template are valid', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'rs-99' });
    vi.spyOn(core, 'RecurringScheduleRepository').mockImplementation(() => ({ create } as any));
    vi.spyOn(core, 'CaregiverRepository').mockImplementation(
      () => ({ findById: vi.fn().mockResolvedValue({ id: 'caregiver-1' }) } as any),
    );
    vi.spyOn(core, 'ScheduleRepository').mockImplementation(
      () => ({ getTemplateClient: vi.fn().mockResolvedValue({ clientId: 'client-1' }) } as any),
    );

    const res = await request(createApp())
      .post('/recurring-schedules')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('rs-99');
    expect(create).toHaveBeenCalled();
  });

  it('rejects an invalid pattern with 400', async () => {
    const res = await request(createApp())
      .post('/recurring-schedules')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ ...validBody, daysOfWeek: [9], startTime: '25:00' });

    expect(res.status).toBe(400);
  });

  it('404s when the caregiver is not in the agency', async () => {
    vi.spyOn(core, 'RecurringScheduleRepository').mockImplementation(() => ({ create: vi.fn() } as any));
    vi.spyOn(core, 'CaregiverRepository').mockImplementation(
      () => ({ findById: vi.fn().mockResolvedValue(null) } as any),
    );

    const res = await request(createApp())
      .post('/recurring-schedules')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send(validBody);

    expect(res.status).toBe(404);
  });

  it('materializes one schedule and audits the run', async () => {
    const materialize = vi
      .fn()
      .mockResolvedValue({ scheduleId: 'rs-1', created: 6, skipped: 2, conflicted: 0, conflicts: [] });
    vi.spyOn(core, 'RecurringScheduleRepository').mockImplementation(() => ({ materialize } as any));
    const auditCreate = vi.fn().mockResolvedValue({});
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: auditCreate } as any));

    const res = await request(createApp())
      .post('/recurring-schedules/rs-1/materialize')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({ days: 30 });

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(6);
    expect(materialize).toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalled();
  });

  it('materializes all active schedules and aggregates counts', async () => {
    const materializeAllActive = vi.fn().mockResolvedValue([
      { scheduleId: 'rs-1', created: 4, skipped: 0, conflicted: 0, conflicts: [] },
      { scheduleId: 'rs-2', created: 2, skipped: 3, conflicted: 0, conflicts: [] },
    ]);
    vi.spyOn(core, 'RecurringScheduleRepository').mockImplementation(
      () => ({ materializeAllActive } as any),
    );
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      () => ({ create: vi.fn().mockResolvedValue({}) } as any),
    );

    const res = await request(createApp())
      .post('/recurring-schedules/materialize')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ schedules: 2, created: 6, skipped: 3, conflicted: 0 });
  });

  it('surfaces refused double-bookings from the bulk run instead of dropping them', async () => {
    // A coordinator reading only created/skipped would think every visit
    // generated; the refused ones have to reach the response and the audit.
    const materializeAllActive = vi.fn().mockResolvedValue([
      { scheduleId: 'rs-1', created: 4, skipped: 0, conflicted: 0, conflicts: [] },
      {
        scheduleId: 'rs-2',
        created: 1,
        skipped: 0,
        conflicted: 2,
        conflicts: [
          '2026-06-15: Caregiver is already booked 2026-06-15 10:00-12:00 UTC, which overlaps this visit.',
          '2026-06-17: Caregiver is already booked 2026-06-17 10:00-12:00 UTC, which overlaps this visit.',
        ],
      },
    ]);
    vi.spyOn(core, 'RecurringScheduleRepository').mockImplementation(
      () => ({ materializeAllActive } as any),
    );
    const auditCreate = vi.fn().mockResolvedValue({});
    vi.spyOn(core, 'AuditEventRepository').mockImplementation(
      () => ({ create: auditCreate } as any),
    );

    const res = await request(createApp())
      .post('/recurring-schedules/materialize')
      .set('Authorization', `Bearer ${makeToken('coordinator')}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ schedules: 2, created: 5, skipped: 0, conflicted: 2 });
    expect(res.body.conflicts).toHaveLength(2);
    expect(res.body.conflicts[0]).toContain('overlaps');
    expect(auditCreate.mock.calls[0][0].payload.conflicted).toBe(2);
  });

  it('forbids caregivers from creating recurring schedules', async () => {
    const res = await request(createApp())
      .post('/recurring-schedules')
      .set('Authorization', `Bearer ${makeToken('caregiver')}`)
      .send(validBody);

    expect(res.status).toBe(403);
  });
});
