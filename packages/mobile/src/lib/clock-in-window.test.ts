import { describe, expect, it } from 'vitest';
import { getClockInWindowState } from './clock-in-window';

const START = '2026-07-08T14:00:00.000Z';
const END = '2026-07-08T16:00:00.000Z';
const at = (iso: string) => Date.parse(iso);

describe('getClockInWindowState', () => {
  it('is unknown without a start or with garbage', () => {
    expect(getClockInWindowState(at(START), undefined, END).state).toBe('unknown');
    expect(getClockInWindowState(at(START), 'garbage', END).state).toBe('unknown');
  });

  it('is unknown for a date-only sentinel (midnight UTC, no end)', () => {
    expect(getClockInWindowState(at(START), '2026-07-08T00:00:00.000Z', undefined).state).toBe('unknown');
  });

  it('reports too-early with the opening moment', () => {
    const s = getClockInWindowState(at('2026-07-08T13:00:00.000Z'), START, END);
    expect(s.state).toBe('too-early');
    if (s.state === 'too-early') {
      expect(s.opensAt).toBe(at('2026-07-08T13:55:00.000Z'));
    }
  });

  it('is open from 5 min before start through the end, including late arrivals', () => {
    expect(getClockInWindowState(at('2026-07-08T13:55:00.000Z'), START, END).state).toBe('open');
    expect(getClockInWindowState(at('2026-07-08T15:59:00.000Z'), START, END).state).toBe('open');
  });

  it('reports expired after the end (or start + 4h without an end)', () => {
    expect(getClockInWindowState(at('2026-07-08T16:01:00.000Z'), START, END).state).toBe('expired');
    const realStartNoEnd = '2026-07-08T14:30:00.000Z';
    expect(getClockInWindowState(at('2026-07-08T18:29:00.000Z'), realStartNoEnd, undefined).state).toBe('open');
    expect(getClockInWindowState(at('2026-07-08T18:31:00.000Z'), realStartNoEnd, undefined).state).toBe('expired');
  });
});
