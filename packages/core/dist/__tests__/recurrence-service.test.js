import { describe, expect, it } from 'vitest';
import { expandRecurrence } from '../services/recurrence-service.js';
const base = {
    daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
    startTime: '09:00',
    endTime: '13:00',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
};
describe('expandRecurrence', () => {
    it('emits one occurrence per matching weekday in the window', () => {
        // 2026-06-01 is a Monday. Window covers Mon 6/1 → Sun 6/7.
        const occ = expandRecurrence(base, '2026-06-01', '2026-06-07');
        expect(occ.map((o) => o.date)).toEqual(['2026-06-01', '2026-06-03', '2026-06-05']);
    });
    it('stamps UTC start/end ISO timestamps from the pattern times', () => {
        const [first] = expandRecurrence(base, '2026-06-01', '2026-06-01');
        expect(first.startsAt).toBe('2026-06-01T09:00:00.000Z');
        expect(first.endsAt).toBe('2026-06-01T13:00:00.000Z');
    });
    it('clamps the window to the pattern start/end date', () => {
        const pattern = { ...base, startDate: '2026-06-03', endDate: '2026-06-05' };
        const occ = expandRecurrence(pattern, '2026-06-01', '2026-06-30');
        expect(occ.map((o) => o.date)).toEqual(['2026-06-03', '2026-06-05']);
    });
    it('returns nothing when the window is before the pattern starts', () => {
        expect(expandRecurrence(base, '2025-01-01', '2025-12-31')).toEqual([]);
    });
    it('returns nothing when no weekday matches', () => {
        const pattern = { ...base, daysOfWeek: [0] }; // Sundays only
        // 2026-06-01 (Mon) → 2026-06-06 (Sat): no Sunday in range.
        expect(expandRecurrence(pattern, '2026-06-01', '2026-06-06')).toEqual([]);
    });
    it('handles an inverted window (start after end) by returning nothing', () => {
        expect(expandRecurrence(base, '2026-06-10', '2026-06-01')).toEqual([]);
    });
    it('walks weekdays correctly across a month boundary', () => {
        // 2026-06-29 Mon, 7/1 Wed, 7/3 Fri.
        const occ = expandRecurrence(base, '2026-06-29', '2026-07-03');
        expect(occ.map((o) => o.date)).toEqual(['2026-06-29', '2026-07-01', '2026-07-03']);
    });
});
//# sourceMappingURL=recurrence-service.test.js.map