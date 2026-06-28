import { describe, expect, it } from 'vitest';
import { detectVisitExceptions } from '../services/evv-exception-service.js';
const cleanVisit = {
    id: '00000000-0000-4000-8000-000000000001',
    assignmentId: '00000000-0000-4000-8000-000000000002',
    caregiverId: '00000000-0000-4000-8000-000000000003',
    clientId: '00000000-0000-4000-8000-000000000004',
    serviceCode: 'T1019',
    clockInTime: '2026-06-28T13:00:00.000Z',
    clockOutTime: '2026-06-28T14:00:00.000Z',
    clockInLocation: { lat: 40.1, lng: -75.1, accuracy: 12 },
    clockOutLocation: { lat: 40.1, lng: -75.1, accuracy: 14 },
    status: 'pending',
};
describe('detectVisitExceptions', () => {
    it('returns no exceptions for a clean, on-time, well-located visit', () => {
        expect(detectVisitExceptions(cleanVisit, { scheduledStartTime: '2026-06-28T13:00:00.000Z' })).toEqual([]);
    });
    it('flags degraded clock-in GPS accuracy as missing-location', () => {
        const v = { ...cleanVisit, clockInLocation: { lat: 40.1, lng: -75.1, accuracy: 250 } };
        const out = detectVisitExceptions(v);
        expect(out).toHaveLength(1);
        expect(out[0].exceptionType).toBe('missing-location');
        expect(out[0].reason).toContain('250m');
    });
    it('flags a late clock-in beyond the grace window', () => {
        const v = { ...cleanVisit, clockInTime: '2026-06-28T13:25:00.000Z' };
        const out = detectVisitExceptions(v, { scheduledStartTime: '2026-06-28T13:00:00.000Z' });
        expect(out.some((e) => e.exceptionType === 'late-clock-in')).toBe(true);
    });
    it('does not flag a clock-in within the grace window', () => {
        const v = { ...cleanVisit, clockInTime: '2026-06-28T13:10:00.000Z' };
        const out = detectVisitExceptions(v, { scheduledStartTime: '2026-06-28T13:00:00.000Z' });
        expect(out.some((e) => e.exceptionType === 'late-clock-in')).toBe(false);
    });
    it('can return multiple exceptions (late + degraded location)', () => {
        const v = {
            ...cleanVisit,
            clockInTime: '2026-06-28T13:40:00.000Z',
            clockInLocation: { lat: 40.1, lng: -75.1, accuracy: 500 },
        };
        const out = detectVisitExceptions(v, { scheduledStartTime: '2026-06-28T13:00:00.000Z' });
        const types = out.map((e) => e.exceptionType).sort();
        expect(types).toContain('late-clock-in');
        expect(types).toContain('missing-location');
    });
});
//# sourceMappingURL=evv-exception-service.test.js.map