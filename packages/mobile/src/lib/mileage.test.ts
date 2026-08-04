import { describe, expect, it } from 'vitest';
import {
  formatMiles,
  parseMiles,
  summarize,
  todayYmd,
  totalHundredths,
  type MileageEntry,
} from './mileage';

function entry(status: MileageEntry['status'], milesHundredths: number): MileageEntry {
  return { id: `e-${status}-${milesHundredths}`, tripDate: '2026-08-04', milesHundredths, purpose: null, status, reviewNote: null };
}

describe('parseMiles', () => {
  it('accepts whole and decimal miles', () => {
    expect(parseMiles('12')).toEqual({ ok: true, miles: 12 });
    expect(parseMiles('12.4')).toEqual({ ok: true, miles: 12.4 });
    expect(parseMiles('12.45')).toEqual({ ok: true, miles: 12.45 });
    expect(parseMiles('  8.5  ')).toEqual({ ok: true, miles: 8.5 });
  });

  it('asks for a number rather than failing silently', () => {
    const result = parseMiles('');
    expect(result.ok).toBe(false);
    // Actionable, not a generic "invalid input".
    if (!result.ok) expect(result.error).toMatch(/Enter how many miles/);
  });

  it('rejects non-numeric and over-precise input', () => {
    expect(parseMiles('twelve').ok).toBe(false);
    expect(parseMiles('12.456').ok).toBe(false);
    expect(parseMiles('1,200').ok).toBe(false);
  });

  it('rejects zero and negative trips, which are mistakes not claims', () => {
    expect(parseMiles('0').ok).toBe(false);
    expect(parseMiles('0.00').ok).toBe(false);
    expect(parseMiles('-5').ok).toBe(false);
  });

  it('catches a slipped decimal before the server has to', () => {
    expect(parseMiles('500').ok).toBe(true);
    const tooHigh = parseMiles('501');
    expect(tooHigh.ok).toBe(false);
    if (!tooHigh.ok) expect(tooHigh.error).toMatch(/too high/);
  });
});

describe('formatMiles', () => {
  it('always shows two decimals', () => {
    expect(formatMiles(1234)).toBe('12.34 mi');
    expect(formatMiles(1200)).toBe('12.00 mi');
    expect(formatMiles(0)).toBe('0.00 mi');
    expect(formatMiles(5)).toBe('0.05 mi');
  });
});

describe('totalHundredths', () => {
  it('sums integrally, with no float drift', () => {
    const entries = Array.from({ length: 10 }, () => entry('approved', 1010));
    expect(totalHundredths(entries)).toBe(10100);
  });

  it('is zero for no entries', () => {
    expect(totalHundredths([])).toBe(0);
  });
});

describe('summarize', () => {
  it('keeps approved and pending apart rather than blending them', () => {
    // A blended total would overstate what is actually coming.
    const result = summarize([
      entry('approved', 1000),
      entry('approved', 500),
      entry('submitted', 2000),
      entry('rejected', 900),
    ]);
    expect(result).toEqual({
      approvedHundredths: 1500,
      submittedHundredths: 2000,
      rejectedCount: 1,
    });
  });

  it('handles an empty list', () => {
    expect(summarize([])).toEqual({
      approvedHundredths: 0,
      submittedHundredths: 0,
      rejectedCount: 0,
    });
  });
});

describe('todayYmd', () => {
  it('formats the date portion only', () => {
    expect(todayYmd(new Date('2026-08-04T22:15:00.000Z'))).toBe('2026-08-04');
  });
});
