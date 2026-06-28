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
        vi.spyOn(core, 'RecurringScheduleRepository').mockImplementation(() => ({ list }));
        const res = await request(createApp())
            .get('/recurring-schedules')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(list).toHaveBeenCalled();
    });
    it('creates a recurring schedule when caregiver and template are valid', async () => {
        const create = vi.fn().mockResolvedValue({ id: 'rs-99' });
        vi.spyOn(core, 'RecurringScheduleRepository').mockImplementation(() => ({ create }));
        vi.spyOn(core, 'CaregiverRepository').mockImplementation(() => ({ findById: vi.fn().mockResolvedValue({ id: 'caregiver-1' }) }));
        vi.spyOn(core, 'ScheduleRepository').mockImplementation(() => ({ getTemplateClient: vi.fn().mockResolvedValue({ clientId: 'client-1' }) }));
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
        vi.spyOn(core, 'RecurringScheduleRepository').mockImplementation(() => ({ create: vi.fn() }));
        vi.spyOn(core, 'CaregiverRepository').mockImplementation(() => ({ findById: vi.fn().mockResolvedValue(null) }));
        const res = await request(createApp())
            .post('/recurring-schedules')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send(validBody);
        expect(res.status).toBe(404);
    });
    it('materializes one schedule and audits the run', async () => {
        const materialize = vi.fn().mockResolvedValue({ scheduleId: 'rs-1', created: 6, skipped: 2 });
        vi.spyOn(core, 'RecurringScheduleRepository').mockImplementation(() => ({ materialize }));
        const auditCreate = vi.fn().mockResolvedValue({});
        vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: auditCreate }));
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
            { scheduleId: 'rs-1', created: 4, skipped: 0 },
            { scheduleId: 'rs-2', created: 2, skipped: 3 },
        ]);
        vi.spyOn(core, 'RecurringScheduleRepository').mockImplementation(() => ({ materializeAllActive }));
        vi.spyOn(core, 'AuditEventRepository').mockImplementation(() => ({ create: vi.fn().mockResolvedValue({}) }));
        const res = await request(createApp())
            .post('/recurring-schedules/materialize')
            .set('Authorization', `Bearer ${makeToken('coordinator')}`)
            .send({});
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ schedules: 2, created: 6, skipped: 3 });
    });
    it('forbids caregivers from creating recurring schedules', async () => {
        const res = await request(createApp())
            .post('/recurring-schedules')
            .set('Authorization', `Bearer ${makeToken('caregiver')}`)
            .send(validBody);
        expect(res.status).toBe(403);
    });
});
//# sourceMappingURL=recurring-schedule-routes.test.js.map