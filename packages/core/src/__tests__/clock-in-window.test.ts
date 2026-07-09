import { describe, expect, it } from 'vitest';
import { checkClockInWindow } from '../services/clock-in-window.js';

const START = '2026-07-08T14:00:00.000Z';
const END = '2026-07-08T16:00:00.000Z';

describe('checkClockInWindow', () => {
  it('fails open with no scheduled start', () => {
    expect(checkClockInWindow('2026-07-08T09:00:00.000Z', null, null)).toBeNull();
    expect(checkClockInWindow('2026-07-08T09:00:00.000Z', undefined, END)).toBeNull();
  });

  it('fails open for a date-only (midnight UTC, no end) assignment', () => {
    expect(
      checkClockInWindow('2026-07-10T23:30:00.000Z', '2026-07-08T00:00:00.000Z', null)
    ).toBeNull();
  });

  it('still gates a midnight-UTC start when a real end exists', () => {
    // Overnight shift starting exactly at midnight UTC with an end time is a
    // real schedule, not the date-only sentinel.
    const v = checkClockInWindow(
      '2026-07-08T09:00:00.000Z',
      '2026-07-09T00:00:00.000Z',
      '2026-07-09T06:00:00.000Z'
    );
    expect(v?.reason).toBe('too-early');
  });

  it('rejects too-early punches with the window bounds', () => {
    const v = checkClockInWindow('2026-07-08T13:00:00.000Z', START, END);
    expect(v).toEqual({
      reason: 'too-early',
      opensAt: '2026-07-08T13:55:00.000Z',
      closesAt: END
    });
  });

  it('allows from 5 minutes before the start through the scheduled end', () => {
    expect(checkClockInWindow('2026-07-08T13:55:00.000Z', START, END)).toBeNull();
    expect(checkClockInWindow('2026-07-08T13:56:30.000Z', START, END)).toBeNull();
    // Late arrival inside the window is allowed (flagged at clock-out, not blocked).
    expect(checkClockInWindow('2026-07-08T15:45:00.000Z', START, END)).toBeNull();
    expect(checkClockInWindow(END, START, END)).toBeNull();
  });

  it('rejects after the scheduled end', () => {
    const v = checkClockInWindow('2026-07-08T16:00:01.000Z', START, END);
    expect(v?.reason).toBe('window-closed');
    expect(v?.closesAt).toBe(END);
  });

  it('falls back to start + 4h when a real start has no end', () => {
    const realStart = '2026-07-08T14:30:00.000Z';
    expect(checkClockInWindow('2026-07-08T18:29:00.000Z', realStart, null)).toBeNull();
    const v = checkClockInWindow('2026-07-08T18:31:00.000Z', realStart, null);
    expect(v?.reason).toBe('window-closed');
    expect(v?.closesAt).toBe('2026-07-08T18:30:00.000Z');
  });

  it('fails open on unparseable timestamps', () => {
    expect(checkClockInWindow('garbage', START, END)).toBeNull();
    expect(checkClockInWindow('2026-07-08T14:00:00.000Z', 'garbage', END)).toBeNull();
  });
});
